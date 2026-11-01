"""Read-only Telegram probe. Never prints tokens or incoming user messages."""
from pathlib import Path
import json, urllib.request, urllib.error
root=Path(__file__).resolve().parents[1]
env={}
for line in (root/'.env').read_text(encoding='utf-8').splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        k,v=line.split('=',1);env[k.strip()]=v.strip()
token=env.get('BOT_TOKEN','')
if not token:
    print(json.dumps({'ok':False,'reason':'BOT_TOKEN missing'}));raise SystemExit(1)
def post(method):
    request=urllib.request.Request('https://api.telegram.org/bot'+token+'/'+method,data=b'{}',headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(request,timeout=20) as response:
        return json.load(response)
try:
    me=post('getMe');hook=post('getWebhookInfo')
    print(json.dumps({'ok':me.get('ok',False),'username':me.get('result',{}).get('username'),'webhookConfigured':bool(hook.get('result',{}).get('url')),'botEnabled':env.get('BOT_ENABLED')=='true'}))
except urllib.error.HTTPError as error:
    print(json.dumps({'ok':False,'httpStatus':error.code}))
except Exception:
    print(json.dumps({'ok':False,'reason':'Telegram connection unavailable'}))
