"""Print a blank edition to stdout. Published editions live in Supabase."""
import argparse
import json
import subprocess
from datetime import date

def calendar_label(iso):
    # Node's standard ICU Chinese calendar supplies leap months and sexagenary years.
    js = """const format = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Shanghai'
    });
    const parts = Object.fromEntries(format.formatToParts(new Date(process.argv[1] + 'T04:00:00Z')).map(p => [p.type, p.value]));
    if (!parts.yearName || !parts.month || !parts.day) process.exit(1);
    const n = Number(parts.day), digits = '一二三四五六七八九十';
    const day = n <= 10 ? '初' + digits[n - 1] : n === 20 ? '二十' : n === 30 ? '三十' : (n < 20 ? '十' : '廿') + digits[n % 10 - 1];
    console.log(parts.yearName + '年' + parts.month + day);"""
    try:
        return subprocess.run(['node', '-e', js, iso], check=True, capture_output=True, text=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError) as exc:
        raise ValueError('无法自动计算农历；可用 --lunar 手动指定农历日期') from exc


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    new = sub.add_parser("new", help="把新一期的输入模板打印到 stdout，不写入文件")
    new.add_argument("date", type=date.fromisoformat)
    new.add_argument("--lunar")
    args = parser.parse_args()
    day = args.date.isoformat()
    try:
        lunar = args.lunar or calendar_label(day)
    except ValueError as exc:
        parser.exit(1, str(exc) + "\n")
    print(json.dumps({"date": day, "lunar": lunar, "stories": [{
        "id": "", "placement": "lead", "category": "", "section": "", "city": "",
        "title": "", "deck": "", "paragraphs": [""], "sources": [["", ""]],
        "photo": {"src": "", "width": None, "height": None, "alt": "", "caption": "",
                  "credit": "", "sourceUrl": "", "label": ""}
    }]}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
