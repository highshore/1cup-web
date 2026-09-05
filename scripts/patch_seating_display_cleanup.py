from pathlib import Path

path = Path("app/meetup/[id]/EventDetailClient.tsx")
text = path.read_text(encoding="utf-8")

phone_fallback = 'if (!validName) return `익명 (${user.phoneLast4 || "****"})`;'
phone_result = 'return `${maskedName} (${user.phoneLast4 || "****"})`;'

if text.count(phone_fallback) != 2:
    raise SystemExit(f"Expected 2 phone fallback labels, found {text.count(phone_fallback)}")
if text.count(phone_result) != 2:
    raise SystemExit(f"Expected 2 phone result labels, found {text.count(phone_result)}")

text = text.replace(phone_fallback, 'if (!validName) return "익명";')
text = text.replace(phone_result, "return maskedName;")

helper_start = '                  <div\n                    style={{\n                      width: "100%",\n                      fontSize: "12px",\n                      color: "#6b7280",\n                      lineHeight: 1.5,\n                    }}\n                  >\n                    모바일에서는 참가자 오른쪽의 ⋮⋮ 핸들을 잡고 이동하세요.\n                  </div>\n'

if text.count(helper_start) != 1:
    raise SystemExit(f"Expected 1 mobile helper block, found {text.count(helper_start)}")

text = text.replace(helper_start, "", 1)
path.write_text(text, encoding="utf-8")
