from app.agents import build_langgraph
import re

def analyze(text):
    state=build_langgraph().invoke({"document_text":text,"retry_count":0,"errors":[]})
    requirements=state["tender_requirements"]; technical=state["technical_results"]; pricing=state["pricing_results"]; quality=state["quality_results"]
    report={"tender_overview":{k:requirements.get(k) for k in ("tender_title","reference_number","buyer","description")},"extracted_requirements":requirements,"technical_results":technical,"pricing_results":pricing,"quality_review":quality,"disclaimer":"Recommendations are ranked candidates, not declarations of compliance or quotations."}
    return {"requirements":requirements,"technical":technical,"pricing":pricing,"quality":quality,"report":report}
def answer_question(analysis, question):
    q=question.lower(); tech=analysis["technical"]; pricing=analysis["pricing"]; requirements=analysis["requirements"]
    recommendations=tech.get("recommendations",[])
    def sources(products):
      seen=set(); output=[]
      for product in products:
       for reference in product.get("source_references",[]):
        key=(reference.get("source"),reference.get("page_number"))
        if key not in seen: output.append(reference); seen.add(key)
      return output
    def failures(product):
      return [c["parameter"] for c in product.get("comparisons",[]) if c.get("result") != "match"]
    def requested_product():
      if "product a" in q: return recommendations[0] if recommendations else None
      if "product b" in q: return recommendations[1] if len(recommendations)>1 else None
      match=re.search(r"\b[A-Z]{2}-[A-Z0-9-]+\b",question)
      return next((p for p in recommendations if p.get("sku_id")==match.group(0)),None) if match else None
    if "compare" in q and len(recommendations)>=2:
      first,second=recommendations[:2]
      return {"answer":f"{first['sku_id']} ranks first at {first['match_percentage']}% and is {'compliant' if first['compliant'] else 'not compliant'}. {second['sku_id']} ranks second at {second['match_percentage']}% and is not compliant because: {', '.join(failures(second)) or 'no reported failures'}.","data":{"products":[first,second]},"sources":sources([first,second])}
    product=requested_product()
    if product and any(word in q for word in ("fail","mismatch","not compliant","specification")):
      issues=failures(product)
      answer=f"{product['sku_id']} has no failed mandatory specifications and is compliant." if not issues else f"{product['sku_id']} is not compliant because it fails: {', '.join(issues)}."
      return {"answer":answer,"data":product,"sources":sources([product])}
    if any(word in q for word in ("required test","testing procedure","which tests","testing procedures")):
      tests=requirements.get("required_tests",[])
      reference=requirements.get("products",[{}])[0].get("source_reference","")
      page=re.search(r"page\s*(\d+)",str(reference),re.I)
      citation={"source":"Tender document"}
      if page: citation["page_number"]=int(page.group(1))
      return {"answer":("Required testing procedures: "+"; ".join(tests)+".") if tests else "Required testing procedures are not available in the saved tender report.","data":{"required_tests":tests},"sources":[citation]}
    if any(word in q for word in ("total cost","total estimate","cost calculated","price","material cost")):
      if pricing.get("pricing_complete"):
       material=pricing.get("material_cost",0); testing=pricing.get("testing_cost",0); total=pricing.get("total_estimated_cost")
       return {"answer":f"Total estimated cost is INR {total:,.0f}: material INR {material:,.0f} plus required testing INR {testing:,.0f}.","data":pricing,"sources":sources(recommendations[:1])}
      return {"answer":"A complete total is unavailable because: "+"; ".join(pricing.get("warnings",["required pricing information is missing"]))+".","data":pricing,"sources":[]}
    if "rank" in q or "second" in q:
      if len(recommendations)<2: return {"answer":"Fewer than two product recommendations are available in the saved report.","data":tech,"sources":sources(recommendations)}
      second=recommendations[1]
      return {"answer":f"{second['sku_id']} ranks second with {second['match_percentage']}%. It is not compliant because: {', '.join(failures(second)) or 'no reported failures'}.","data":second,"sources":sources([second])}
    if "reference" in q: return {"answer":requirements.get("reference_number") or "Tender reference is not available in the saved report.","data":{"reference_number":requirements.get("reference_number")},"sources":[]}
    return {"answer":"The requested information is not available in the saved tender report. Ask about product comparisons, required tests, or the saved cost breakdown.","data":None,"sources":[]}
