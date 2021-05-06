const test = require('tape')
const createLayout = require('./')
const font = require('./demo/NotoSans-Regular.json');

test('should export API', function(t) {
  t.throws(createLayout.bind(null, { font: null }), 'should throw error')
  const xGlyph = font.charsMap["x"];
  if (!xGlyph)
    t.fail('no x character in font');
  
  xGlyph._x = 0;
  const xHeight = xGlyph.h
  const baseline = font.common.base
  const lineHeight = font.common.lineHeight
  const descender = lineHeight - baseline
 
  let layout = createLayout({
    text: 'x',
    font: font
  })

  t.equal(layout.height, lineHeight - descender, 'line height matches')
  t.equal(layout.width, xGlyph.w + xGlyph._x, 'width matches')
  t.equal(layout.descender, lineHeight - baseline, 'descender matches')
  t.equal(layout.ascender, lineHeight - descender - xHeight, 'ascender matches')
  t.equal(layout.xHeight, xHeight, 'x-height matches')
  t.equal(layout.baseline, baseline, 'baseline matches')
  
 layout = createLayout({
    text: 'xx',
    font: font
  })
  const lineWidth = xGlyph.xA + xGlyph.w + xGlyph._x
  t.equal(layout.width, lineWidth, 'calculates whole width')

  layout = createLayout({
    text: 'xx\nx',
    font: font
  })
  t.equal(layout.width, lineWidth, 'multi line width matches')

  const spacing = 4
  layout = createLayout({
    text: 'xx',
    letterSpacing: spacing,
    font: font
  })
  t.equal(layout.width, lineWidth + spacing, 'letter spacing matches')
  
  layout = createLayout({
    text: 'hx\nab',
    font: font
  })
  
  t.deepEqual(layout.glyphs.map(function (x) {
    return String.fromCharCode(x.data.id) 
  }).join(''), 'hxab', 'provides glyphs')
  
  t.deepEqual(layout.glyphs.map(function (x) {
    return x.line
  }), [ 0, 0, 1, 1 ], 'provides lines')
  
  t.deepEqual(layout.glyphs.map(function (x) {
    return x.index
  }), [ 0, 1, 3, 4 ], 'provides indices')
  t.end()
})