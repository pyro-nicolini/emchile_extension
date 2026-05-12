import io
content = io.open('sidebar.html', 'r', encoding='utf-8-sig').read()
old = '        <button class="ic-btn ic-tabla" id="js-tabla" title="Tabla de OCs">\u229e</button>'
exp_btn = '        <button class="ic-btn ic-exp" id="js-experimental" title="An\u00e1lisis Experimental Masivo">\U0001F9EA</button>'
new = old + '\r\n' + exp_btn
result = content.replace(old, new, 1)
io.open('sidebar.html', 'w', encoding='utf-8').write(result)
print('Done. Changed:', result != content)
