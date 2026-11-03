from fastapi.testclient import TestClient
from app.main import app

def test_health():
    with TestClient(app) as client:
        assert client.get('/api/v1/health').json()['success']

def test_upload_analyze_report():
    content=b'Tender Title: Demo Cable Tender\nReference No: ABC-1\nProduct Category: Cable\n11 kV Aluminium 3 cores 240 mm2 XLPE Steel Wire\nQuantity: 100 metre\nTesting required: Conductor Resistance Test'
    with TestClient(app) as client:
        response=client.post('/api/v1/tenders/upload',files={'file':('tender.txt',content,'text/plain')})
        assert response.status_code==200
        tid=response.json()['data']['tender_id']
        assert client.post(f'/api/v1/tenders/{tid}/analyze').status_code==200
        report=client.get(f'/api/v1/tenders/{tid}/report').json()['data']
        assert report['technical_results']['recommendations'][0]['sku_id']=='AG-11-240-AL-STA'
