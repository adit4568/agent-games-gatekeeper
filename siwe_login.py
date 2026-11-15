import json, datetime, requests
from eth_account import Account
from eth_account.messages import encode_defunct

W = json.load(open("wallet.json"))
S = requests.Session()
S.headers.update({"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
                  "Origin":"https://agentgames.zkverify.io","Referer":"https://agentgames.zkverify.io/register"})
BASE="https://agentgames.zkverify.io"

nonce = S.get(BASE+"/api/auth/wallet/siwe/nonce", timeout=20).json()["nonce"]
now = datetime.datetime.now(datetime.timezone.utc)
iat = now.strftime("%Y-%m-%dT%H:%M:%S.000Z")
exp = (now+datetime.timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
addr = W["address"]
msg = (f"agentgames.zkverify.io wants you to sign in with your Ethereum account:\n{addr}\n\n"
       f"Sign in to Agent Games with your wallet.\n\n"
       f"URI: {BASE}\nVersion: 1\nChain ID: 1\nNonce: {nonce}\nIssued At: {iat}\nExpiration Time: {exp}")
sig = Account.sign_message(encode_defunct(text=msg), private_key=W["pk"]).signature.hex()
if not sig.startswith("0x"): sig = "0x"+sig

csrf = S.get(BASE+"/api/auth/csrf", timeout=20).json()["csrfToken"]
r = S.post(BASE+"/api/auth/callback/wallet",
           data={"csrfToken":csrf,"message":msg,"signature":sig,"callbackUrl":BASE,"json":"true"},
           timeout=25, allow_redirects=False)
print("login status:", r.status_code, r.text[:300])
sess = S.get(BASE+"/api/auth/session", timeout=20).json()
print("session:", json.dumps(sess)[:400])
json.dump(S.cookies.get_dict(), open("cookies.json","w"))
open("siwe_msg.txt","w").write(msg)
