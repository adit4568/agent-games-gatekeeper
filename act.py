import json, requests, sys
ck=json.load(open("cookies.json"))
S=requests.Session(); S.cookies.update(ck)
S.headers.update({"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0","Origin":"https://agentgames.zkverify.io","Referer":"https://agentgames.zkverify.io/register"})
ACTION="00a4f5d166e6c6557837ca383670b0950e1ffb3f86"
payload=[{"handle":"nikazkv01","email":"nikazkv01@divia.biz.id"}]
r=S.post("https://agentgames.zkverify.io/register", data=json.dumps(payload),
         headers={"Next-Action":ACTION,"Content-Type":"text/plain;charset=UTF-8"}, timeout=25)
print(r.status_code)
print(r.text[:1500])
