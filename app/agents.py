"""Bounded coordinator nodes.  Kept independent from API handlers for testability."""
from typing import TypedDict, Any
from app.services import match_products, calculate_pricing, review_quality
from app.llm import extract_requirements
from app.rag import retrieve
import re

class TenderState(TypedDict, total=False):
    tender_id: str
    document_text: str
    tender_requirements: dict[str, Any]
    technical_results: dict[str, Any]
    pricing_results: dict[str, Any]
    quality_results: dict[str, Any]
    errors: list[str]
    retry_count: int

def extraction_node(state: TenderState): return {"tender_requirements":extract_requirements(state["document_text"])}
def technical_node(state: TenderState):
    requirement=state["tender_requirements"]["products"][0]; result=match_products(requirement,state["tender_requirements"].get("mandatory_fields"))
    for candidate in result["recommendations"]:
        evidence=retrieve(f"{candidate['sku_id']} {candidate['product_name']}",top_k=5)
        # Do not cite a neighbouring product's datasheet chunk as evidence for
        # this candidate.  Catalogue provenance remains when no matching chunk
        # is indexed for the SKU.
        matching=[x for x in evidence if candidate["sku_id"].lower() in x.get("text","").lower()]
        candidate["source_references"] += [{"source":x["filename"],"page_number":x.get("page_number"),"retrieval_method":x.get("retrieval_method","faiss")} for x in matching]
        candidate["source_references"]=_dedupe_sources(candidate["source_references"])
    return {"technical_results":result}

def _dedupe_sources(references):
    clean=[]; seen=set()
    for reference in references:
      source=reference.get("source") or ""
      page=reference.get("page_number")
      match=re.match(r"(.+?)(?:,?\s*page\s*(\d+))?$",source,re.I)
      if match:
        source=match.group(1).strip(); page=page or (int(match.group(2)) if match.group(2) else None)
      value={"source":source}
      if page is not None: value["page_number"]=page
      key=(source,page)
      if source and key not in seen: clean.append(value); seen.add(key)
    return clean
def pricing_node(state: TenderState):
    requirement=state["tender_requirements"]["products"][0]
    return {"pricing_results":calculate_pricing(requirement,state["technical_results"],state["tender_requirements"].get("required_tests",[]))}
def quality_node(state: TenderState):
    return {"quality_results":review_quality(state["tender_requirements"],state["technical_results"],state["pricing_results"],state.get("retry_count",0))}

def build_langgraph():
    """Create the LangGraph graph when installed; import is delayed for offline unit tests."""
    from langgraph.graph import StateGraph, START, END
    graph=StateGraph(TenderState)
    graph.add_node("extract",extraction_node); graph.add_node("technical",technical_node); graph.add_node("pricing",pricing_node); graph.add_node("quality",quality_node)
    graph.add_edge(START,"extract"); graph.add_edge("extract","technical"); graph.add_edge("technical","pricing"); graph.add_edge("pricing","quality"); graph.add_edge("quality",END)
    return graph.compile()
