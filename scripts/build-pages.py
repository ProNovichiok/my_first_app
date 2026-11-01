"""Build the static classroom demo using only Python's standard library."""
from pathlib import Path
import json, shutil
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'public'
dest=ROOT/'pages'
dest.mkdir(exist_ok=True)
# Copy only explicitly public assets; never runtime data or credentials.
for p in source.rglob('*'):
    if p.is_file() and p.suffix.lower() in {'.html','.css','.js','.svg','.webp','.txt','.json','.xlsx'}:
        target=dest/p.relative_to(source)
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(p,target)
(dest/'site-config.json').write_text(json.dumps({'mode':'demo','version':'3.0.0'},ensure_ascii=False),encoding='utf-8')
company=json.loads((ROOT/'config/company.json').read_text(encoding='utf-8'))
cars=json.loads((ROOT/'config/cars.json').read_text(encoding='utf-8'))
public_cars=[{k:v for k,v in c.items() if k not in {'vin','plate','sts','insurance'}} for c in cars]
public_company={k:company[k] for k in ('minAge','minExperienceYears','mileagePerDay','extraKmPrice','pickupAddress','phone','email')}
(dest/'catalog.json').write_text(json.dumps({'demo':True,'brand':company['brand'],'cars':public_cars,'company':public_company},ensure_ascii=False,indent=2),encoding='utf-8')
(dest/'.nojekyll').write_text('',encoding='utf-8')
print('Static demo built. No credentials or client database were copied.')
