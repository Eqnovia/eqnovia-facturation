import base64
with open('Logo Eqnovia.PNG', 'rb') as f:
    data = f.read()
    b64 = base64.b64encode(data).decode()
with open('js/logo_loader.js', 'w', encoding='utf-8') as out:
    out.write('// Auto-generated logo loader\n')
    out.write('(function(){\n')
    out.write("  var b64 = '" + b64 + "';\n")
    out.write("  try{ localStorage.setItem('eqnovia_logo_base64', 'data:image/png;base64,' + b64); } catch(e){}\n")
    out.write('})();\n')
print('Written successfully: ' + str(len(b64)) + ' chars')
