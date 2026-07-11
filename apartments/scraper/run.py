import re
import json
import time
from datetime import datetime
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

def parse_price(text):
    match = re.search(r'(\d[\d\s]*)\s*kr', text.replace('\xa0', ' '))
    if match:
        return int(re.sub(r'\D', '', match.group(1)))
    return None

def check_date(date_str):
    date_str = date_str.lower()
    if "överenskommelse" in date_str or "omgående" in date_str:
        return True
    
    months = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'maj': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'okt': 10, 'nov': 11, 'dec': 12
    }
    
    try:
        match = re.search(r'(\d{1,2})\s+([a-z]{3})', date_str)
        if match:
            day = int(match.group(1))
            month_str = match.group(2)
            month = months.get(month_str, 1)
            
            if month > 8:
                return True
            elif month == 8 and day >= 25:
                return True
            return False
            
        match2 = re.search(r'(\d{4})-(\d{2})-(\d{2})', date_str)
        if match2:
            month = int(match2.group(2))
            day = int(match2.group(3))
            if month > 8:
                return True
            elif month == 8 and day >= 25:
                return True
            return False
            
    except Exception:
        pass
        
    return True

def is_close_to_bth(text):
    text_lower = text.lower()
    good_areas = ['gräsvik', 'minervavägen', 'kolonivägen', 'pantarholmen', 'bergåsa', 'galgamarken']
    if any(area in text_lower for area in good_areas):
        return True
    return True 

def translate_to_english(text):
    replacements = {
        'Student & Ungdom': 'Student & Youth',
        'Studentbostad': 'Student Housing',
        'Inflyttning:': 'Move-in date:',
        'Enligt överenskommelse': 'Upon agreement',
        'omgående': 'Immediately',
        'kr/månad': 'SEK/month',
        'kr/mån': 'SEK/month',
        'rum': 'room(s)',
        'månad': 'month',
        ' aug. ': ' Aug ',
        ' sep. ': ' Sep ',
        ' okt. ': ' Oct ',
        ' nov. ': ' Nov ',
        ' dec. ': ' Dec ',
        ' jan. ': ' Jan ',
        ' feb. ': ' Feb ',
        ' mar. ': ' Mar ',
        ' apr. ': ' Apr ',
        ' maj. ': ' May ',
        ' jun. ': ' Jun ',
        ' jul. ': ' Jul '
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
        
    parts = [p.strip() for p in text.split('|')]
    new_parts = []
    for p in parts:
        if 'SEK/month' in p or re.search(r'\d[\d\s]*kr', p):
            continue
        p = p.replace('m²', 'sqm')
        new_parts.append(p)
        
    return ' | '.join(new_parts)

def extract_image(a_tag, base_url=""):
    img = a_tag.find('img')
    if img and img.get('src'):
        src = img.get('src')
        return base_url + src if src.startswith('/') else src
        
    for child in a_tag.find_all(True):
        style = child.get('style', '')
        if 'background-image' in style:
            match = re.search(r"url\(['\"]?(.*?)['\"]?\)", style)
            if match:
                src = match.group(1)
                return base_url + src if src.startswith('/') else src
                
    return 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=60'

def scrape_sbs(page):
    results = []
    others = []
    try:
        page.goto("https://sbsstudent.se/lediga-bostader/?qt_mll_search_tags=Karlskrona")
        page.wait_for_timeout(4000)
        soup = BeautifulSoup(page.content(), 'html.parser')
        
        for a in soup.find_all('a'):
            text = a.get_text(separator=' | ', strip=True)
            if "kr/mån" in text and "Karlskrona" in text:
                price = parse_price(text)
                href = a.get('href', '')
                img_url = extract_image(a, "")
                
                item = {
                    'id': href,
                    'source': 'SBS',
                    'url': href,
                    'title': translate_to_english(text).split(' | ')[2] if len(text.split(' | ')) > 2 else 'Student Apartment',
                    'price': price,
                    'details': translate_to_english(text),
                    'image': img_url
                }
                
                # Validation
                valid = True
                if price and price >= 5000:
                    valid = False
                
                date_match = re.search(r'Inflyttning:\s*([^|]+)', text)
                if date_match and valid:
                    if not check_date(date_match.group(1).strip()):
                        valid = False
                        
                if valid and not is_close_to_bth(text):
                    valid = False
                    
                if href not in [r['url'] for r in results] and href not in [r['url'] for r in others]:
                    if valid:
                        results.append(item)
                    else:
                        others.append(item)
    except Exception as e:
        print(f"Error scraping SBS: {e}")
        
    return results, others

def scrape_karlskronahem(page):
    results = []
    others = []
    try:
        page.goto("https://marknad.karlskronahem.se/ledigt/studentlagenhet")
        page.wait_for_timeout(5000)
        soup = BeautifulSoup(page.content(), 'html.parser')
        
        for a in soup.find_all('a'):
            text = a.get_text(separator=' | ', strip=True)
            if "kr/mån" in text or "kr/månad" in text:
                price = parse_price(text)
                href = "https://marknad.karlskronahem.se" + a.get('href', '') if a.get('href', '').startswith('/') else a.get('href', '')
                img_url = extract_image(a, "https://marknad.karlskronahem.se")
                
                item = {
                    'id': href,
                    'source': 'Karlskronahem',
                    'url': href,
                    'title': translate_to_english(text).split(' | ')[0] if len(text.split(' | ')) > 0 else 'Student Apartment',
                    'price': price,
                    'details': translate_to_english(text),
                    'image': img_url
                }
                
                valid = True
                if price and price >= 5000:
                    valid = False
                if valid and not is_close_to_bth(text):
                    valid = False
                    
                if href not in [r['url'] for r in results] and href not in [r['url'] for r in others]:
                    if valid:
                        results.append(item)
                    else:
                        others.append(item)
    except Exception as e:
        print(f"Error scraping Karlskronahem: {e}")
        
    return results, others

def main():
    print(f"[{datetime.now()}] Starting apartment monitor...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        sbs_ok, sbs_other = scrape_sbs(page)
        kh_ok, kh_other = scrape_karlskronahem(page)
        
        browser.close()
        
    all_ok = sbs_ok + kh_ok
    all_other = sbs_other + kh_other
    
    data = {
        'last_updated': datetime.now().isoformat(),
        'count': len(all_ok),
        'apartments': all_ok,
        'other_apartments': all_other
    }
    
    out_path = '/data/data.json'
    try:
        with open(out_path, 'w') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"[{datetime.now()}] Successfully saved {len(all_ok)} ok and {len(all_other)} other to {out_path}")
    except Exception as e:
        print(f"Failed to write data: {e}")

if __name__ == "__main__":
    main()
