from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "app/payment/RegionalPaymentClient.tsx"
MEDIA_DIR = ROOT / "public/images/payment"


def download(url: str, output: Path) -> None:
    req = Request(url, headers={"User-Agent": "Mozilla/5.0 1CupEnglish/1.0"})
    with urlopen(req, timeout=60) as response:
        output.write_bytes(response.read())


def cover(src: Path, dst: Path, width: int = 1400, height: int = 900) -> None:
    image = Image.open(src).convert("RGB")
    scale = max(width / image.width, height / image.height)
    resized = image.resize(
        (round(image.width * scale), round(image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - width) // 2
    top = (resized.height - height) // 2
    resized.crop((left, top, left + width, top + height)).save(
        dst, "WEBP", quality=84, method=6
    )


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


text = TARGET.read_text()
if "MEMBERSHIP_CARD_MEDIA" in text:
    print("Payment patch already applied; nothing to do.")
    raise SystemExit(0)

MEDIA_DIR.mkdir(parents=True, exist_ok=True)
anam_raw = Path("/tmp/anam.jpg")
yeouido_raw = Path("/tmp/yeouido.png")
download(
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/KU%20Main%20Building.jpg?width=1600",
    anam_raw,
)
download(
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/Yeouido.png?width=1600",
    yeouido_raw,
)
cover(anam_raw, MEDIA_DIR / "anam-korea-university.webp")
cover(yeouido_raw, MEDIA_DIR / "yeouido.webp")

text = replace_once(
    text,
    'type ProductId = "membership_30d" | "participation_pack_5";\n',
    '''type ProductId = "membership_30d" | "participation_pack_5";\n\nconst MEMBERSHIP_CARD_MEDIA: Record<\n  Region,\n  { src: string; credit: string; creditHref: string }\n> = {\n  anam: {\n    src: "/images/payment/anam-korea-university.webp",\n    credit: "Korea University · Chocolatte2 / CC BY-SA 4.0",\n    creditHref: "https://commons.wikimedia.org/wiki/File:KU_Main_Building.jpg",\n  },\n  yeouido: {\n    src: "/images/payment/yeouido.webp",\n    credit: "Yeouido · CC0 / Wikimedia Commons",\n    creditHref: "https://commons.wikimedia.org/wiki/File:Yeouido.png",\n  },\n};\n''',
    "insert card media",
)
text = replace_once(
    text,
    '  const regionLabel = copy.locations[region];\n',
    '  const regionLabel = copy.locations[region];\n  const cardMedia = MEMBERSHIP_CARD_MEDIA[region];\n',
    "insert selected card media",
)
text = replace_once(
    text,
    '''\n          <div className="flex flex-col items-end gap-2 max-[720px]:items-start">\n            <p className="m-0 text-[12px] font-bold text-[#64748b]">\n              {copy.locationLabel}\n            </p>\n            <div className="flex gap-1 rounded-[22px] bg-[#eaeae8] p-1">\n              {(["anam", "yeouido"] as Region[]).map((location) => (\n                <button\n                  key={location}\n                  type="button"\n                  onClick={() => selectRegion(location)}\n                  className={`h-9 min-w-[76px] rounded-[18px] px-4 text-[13px] font-bold transition-colors ${\n                    region === location\n                      ? "bg-[#050505] text-white"\n                      : "text-[#050505] hover:bg-white/70"\n                  }`}\n                  aria-pressed={region === location}\n                >\n                  {copy.locations[location]}\n                </button>\n              ))}\n            </div>\n          </div>''',
    "",
    "remove header location switch",
)
text = replace_once(
    text,
    '''        <section className="grid grid-cols-[430px_minmax(0,1fr)] gap-11 rounded-[28px] border-2 border-[#050505] bg-white p-[34px] shadow-[6px_6px_0_rgba(5,5,5,0.13)] max-[900px]:grid-cols-1 max-[900px]:gap-8 max-[600px]:rounded-[22px] max-[600px]:p-5">''',
    '''        <section className="relative grid grid-cols-[430px_minmax(0,1fr)] gap-11 rounded-[28px] border-2 border-[#050505] bg-white px-[34px] pb-[34px] pt-[98px] shadow-[6px_6px_0_rgba(5,5,5,0.13)] max-[900px]:grid-cols-1 max-[900px]:gap-8 max-[600px]:rounded-[22px] max-[600px]:px-5 max-[600px]:pb-5 max-[600px]:pt-[92px]">\n          <div className="absolute left-1/2 top-[20px] z-10 flex -translate-x-1/2 flex-col items-center gap-1.5">\n            <p className="m-0 text-[11px] font-bold text-[#64748b]">\n              {copy.locationLabel}\n            </p>\n            <div className="flex gap-1 rounded-[22px] bg-[#eaeae8] p-1">\n              {(["anam", "yeouido"] as Region[]).map((location) => (\n                <button\n                  key={location}\n                  type="button"\n                  onClick={() => selectRegion(location)}\n                  className={`h-9 min-w-[76px] rounded-[18px] px-4 text-[13px] font-bold transition-colors ${\n                    region === location\n                      ? "bg-[#050505] text-white"\n                      : "text-[#050505] hover:bg-white/70"\n                  }`}\n                  aria-pressed={region === location}\n                >\n                  {copy.locations[location]}\n                </button>\n              ))}\n            </div>\n          </div>''',
    "move location switch",
)
text = replace_once(
    text,
    '          <div className="flex min-w-0 flex-col gap-4">\n            <div className="relative h-[254px] w-full overflow-hidden rounded-[24px] border-2 border-[#050505] bg-[#f47a4a] shadow-[4px_4px_0_rgba(5,5,5,0.95)]">\n              <div className="absolute -right-[78px] -top-[54px] h-[210px] w-[210px] rounded-full bg-white/25" />\n              <div className="absolute -bottom-1 -right-0 h-24 w-24 rounded-full bg-white/20" />\n',
    '''          <div className="flex min-w-0 flex-col justify-center">\n            <div\n              className="relative h-[254px] w-full overflow-hidden rounded-[24px] border-2 border-[#050505] bg-[#f47a4a] shadow-[4px_4px_0_rgba(5,5,5,0.95)]"\n              style={{\n                backgroundImage: `linear-gradient(112deg, rgba(244,122,74,0.93) 0%, rgba(244,122,74,0.78) 42%, rgba(5,5,5,0.20) 100%), url("${cardMedia.src}")`,\n                backgroundPosition: region === "anam" ? "center 45%" : "center 55%",\n                backgroundSize: "cover",\n              }}\n            >\n''',
    "center and photo-enable card",
)
text = replace_once(
    text,
    '''              <p className="absolute bottom-[10px] left-[22px] m-0 text-[11px] font-medium">\n                {copy.membership.renewal}\n              </p>\n            </div>''',
    '''              <p className="absolute bottom-[10px] left-[22px] m-0 text-[11px] font-medium">\n                {copy.membership.renewal}\n              </p>\n              <a\n                href={cardMedia.creditHref}\n                target="_blank"\n                rel="noopener noreferrer"\n                className="absolute bottom-[9px] right-[12px] max-w-[190px] truncate text-right text-[8px] font-medium text-white/75 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)] hover:text-white hover:underline"\n              >\n                {cardMedia.credit}\n              </a>\n            </div>''',
    "add photo attribution",
)
text = replace_once(
    text,
    '''            <p className="mt-2 text-center text-[11px] font-medium leading-4 text-[#64748b]">\n              {copy.checkout.payplePrefix}\n              <a\n                href="https://www.payple.kr/"\n                target="_blank"\n                rel="noopener noreferrer"\n                className="font-bold text-[#f47a4a] underline underline-offset-2"\n              >\n                Payple\n              </a>\n              {copy.checkout.paypleSuffix}\n            </p>\n\n''',
    "",
    "remove old payple position",
)
text = replace_once(
    text,
    '''            <p className="mt-4 text-[11px] leading-[17px] text-[#64748b]">\n              {isPack ? copy.checkout.flexAfterPay : copy.checkout.membershipAfterPay}\n            </p>''',
    '''            <p className="mt-4 text-[11px] font-medium leading-[17px] text-[#64748b]">\n              {copy.checkout.payplePrefix}\n              <a\n                href="https://www.payple.kr/"\n                target="_blank"\n                rel="noopener noreferrer"\n                className="font-bold text-[#f47a4a] underline underline-offset-2"\n              >\n                Payple\n              </a>\n              {copy.checkout.paypleSuffix}\n            </p>''',
    "move payple below payment button",
)

TARGET.write_text(text)
print("Payment patch applied.")
