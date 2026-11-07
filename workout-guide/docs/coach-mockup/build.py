import re, base64, sys, os
tpl = open(sys.argv[1]).read()
assets = sys.argv[2]
script = tpl.split('<script>')[1]
ex_block = script.split('const EX = {')[1].split('};')[0]
slugs = set(re.findall(r"'([a-z0-9-]+)':", ex_block))
css = []
for slug in sorted(slugs):
    for i in (1,2,3):
        f = os.path.join(assets, slug, f'frame-{i}.svg')
        data = base64.b64encode(open(f,'rb').read()).decode()
        css.append(f'.f-{slug}-{i}{{--m:url(data:image/svg+xml;base64,{data})}}')
out = tpl.replace('/*FRAMES_CSS*/', '\n'.join(css))
open(sys.argv[3], 'w').write(out)
print(len(slugs), 'exercises', round(len(out)/1e6,2), 'MB')
