import re, sys
# TS/TSX 주석만 제거 — 문자열 안의 //, /* 는 건드리지 않는다(정규식으로 문자열을 먼저 소비)
def strip(src):
    out=[]; i=0; n=len(src)
    while i<n:
        c=src[i]
        if c in '"\'`':                      # 문자열/템플릿 — 통째로 옮긴다
            q=c; out.append(c); i+=1
            while i<n:
                if src[i]=='\\': out.append(src[i:i+2]); i+=2; continue
                out.append(src[i])
                if src[i]==q: i+=1; break
                i+=1
            continue
        if c=='/' and i+1<n and src[i+1]=='/':
            while i<n and src[i]!='\n': i+=1
            continue
        if c=='/' and i+1<n and src[i+1]=='*':
            i+=2
            while i+1<n and not (src[i]=='*' and src[i+1]=='/'): i+=1
            i+=2; continue
        out.append(c); i+=1
    return ''.join(out)
p=sys.argv[1]
s=open(p,encoding='utf8').read()
open(p,'w',encoding='utf8').write(strip(s))
