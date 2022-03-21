const wordWrap = require('word-wrapper')
const xtend = require('xtend')
const number = require('as-number')
const reshaper = require('arabic-persian-reshaper');

const X_HEIGHTS = ['x', 'e', 'a', 'o', 'n', 's', 'r', 'c', 'u', 'm', 'v', 'w', 'z']
const M_WIDTHS = ['m', 'w']
const CAP_HEIGHTS = ['H', 'I', 'N', 'E', 'F', 'K', 'L', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
const ARABIC_CHARSET_RANGE = `
  0600–06FF 
  0750–077F 
  08A0–08FF 
  FB50–FDFF 
  FE70–FEFF 
  10E60–10E7F
  1EC70–1ECBF 
  1ED00–1ED4F
  1EE00–1EEFF`.split("\n")
  .map((range) => String(range).trim().replace(/\n|\t|\r/igm,""))
  .filter((range) => range);

const TAB_ID = '\t'
const SPACE_ID = ' '
const ALIGN_LEFT = 0, 
    ALIGN_CENTER = 1, 
    ALIGN_RIGHT = 2

const containArabic = (str) => {
  let strArrayMap = {};
  [...String(str)].forEach((strChar) => {
    strArrayMap[strChar] = true;
  });
  if(Object.keys(strArrayMap).length === 0){
    return false;
  }

  for (let index = 0; index < ARABIC_CHARSET_RANGE.length; index++) {
    const range = ARABIC_CHARSET_RANGE[index];
    if ((/\–/img).test(range)) {
      let minMax = range.split((/\–/img)).map(v => Number(`0x${v}`));
      for (const key in strArrayMap) {
         if (key.charCodeAt(0) >= minMax[0] && key.charCodeAt(0) <= minMax[1]) {
          return true;
        }
      }
    } else if (strArrayMap[String.fromCharCode(Number(`0x${range}`))]) {
      return true;
    }
  }
  return false;
};

const revertArabic = (str) => {
  let strArr = [...str];
  let newStrArr = [];
  let arabicArr = [];
  strArr.forEach((char,i) => {
    if(containArabic(char)){
      arabicArr.push(char);
    }else if(char == ' ' &&  arabicArr.length > 0 && containArabic(strArr[i+1] || '')){
      arabicArr.push(char);
    }else if(arabicArr.length > 0){
      newStrArr.push(...arabicArr.reverse());
      arabicArr = [];
      newStrArr.push(char);
    }else{
      newStrArr.push(char);
    }
  })
  if(arabicArr.length > 0){
    newStrArr.push(...arabicArr.reverse());
  }
  return newStrArr.join('');
}

function TextLayout(opt) {
  this.glyphs = []
  this._measure = this.computeMetrics.bind(this)
  this.update(opt)
}

TextLayout.prototype.update = function(opt) {
  opt = xtend({
    measure: this._measure
  }, opt)
  this._opt = opt
  this._opt.tabSize = number(this._opt.tabSize, 4)

  if (!opt.font)
    throw new Error('must provide a valid bitmap font')

  let glyphs = this.glyphs
  let text = opt.text||'' 

  if(containArabic(text)){
    text = reshaper.ArabicShaper.convertArabic(text);
    text = revertArabic(text);
  }

  let font = opt.font
  this._setupSpaceGlyphs(font)
  
  let lines = wordWrap.lines(text, opt)
  let minWidth = 0
  let maxWidth = opt.width || 560;

  //clear glyphs
  glyphs.length = 0

  //get max line width
  let maxLineWidth = lines.reduce(function(prev, line) {
    return Math.max(prev, line.width, minWidth)
  }, 0)

  //the pen position
  let x = 0
  let y = 0
  let lineHeight = number(opt.lineHeight, font.common.lineHeight)
  let baseline = font.common.base
  let descender = lineHeight-baseline
  let letterSpacing = opt.letterSpacing || 0
  let height = lineHeight * lines.length - descender
  let align = getAlignType(this._opt.align)

  //draw text along baseline
  y -= height
  
  //the metrics for this text layout
  this._width = maxLineWidth > maxWidth ? maxWidth : maxLineWidth;
  this._height = height
  this._descender = lineHeight - baseline
  this._baseline = baseline
  this._xHeight = getXHeight(font)
  this._capHeight = getCapHeight(font)
  this._lineHeight = lineHeight
  this._ascender = lineHeight - descender - this._xHeight
    
  //layout each glyph
  let self = this
  lines.forEach(function(line, lineIndex) {
    let start = line.start
    let end = line.end
    let lineWidth = line.width
    let lastGlyph
    
    //for each glyph in that line...
    for (let i=start; i<end; i++) {
      let id = text.charAt(i)
      let glyph = self.getGlyph(font, id)
      if (glyph) {
        if (lastGlyph) 
          x += getKerning(font, lastGlyph.id, glyph.id)

        let tx = x
        if (align === ALIGN_CENTER) 
          tx += (maxLineWidth-lineWidth)/2
        else if (align === ALIGN_RIGHT)
          tx += (maxLineWidth-lineWidth)

        glyphs.push({
          position: [tx, y],
          data: glyph,
          index: i,
          line: lineIndex
        })  

        //move pen forward
        x += glyph.xA + letterSpacing
        lastGlyph = glyph
      }
    }

    //next line down
    y += lineHeight
    x = 0
  })
  this._linesTotal = lines.length;
}

TextLayout.prototype._setupSpaceGlyphs = function(font) {
  //These are fallbacks, when the font doesn't include
  //' ' or '\t' glyphs
  this._fallbackSpaceGlyph = null
  this._fallbackTabGlyph = null

  if (!font.charsMap)
    return

  //try to get space glyph
  //then fall back to the 'm' or 'w' glyphs
  //then fall back to the first glyph available
  let space = findChar(font, SPACE_ID) 
          || getMGlyph(font) 

  if(!space)
    return;

  //and create a fallback for tab
  let tabWidth = this._opt.tabSize * space.xA;
  this._fallbackSpaceGlyph = space
  this._fallbackTabGlyph = xtend(space, {
    x: 0, y: 0, xA: tabWidth, id:  TAB_ID.charCodeAt(0), 
    _x: 0, _y: 0, w: 0, h: 0
  })
}

TextLayout.prototype.getGlyph = function(font, id) {
  let glyph = findChar(font, id)
  if (glyph)
    return glyph
  else if (id === TAB_ID) 
    return this._fallbackTabGlyph
  else if (id === SPACE_ID) 
    return this._fallbackSpaceGlyph
  return null
}

TextLayout.prototype.computeMetrics = function(text, start, end, width) {
  let letterSpacing = this._opt.letterSpacing || 0
  let font = this._opt.font
  let curPen = 0
  let curWidth = 0
  let count = 0
  let glyph
  let lastGlyph

  if (!font.charsMap) {
    return {
      start: start,
      end: start,
      width: 0
    }
  }

  end = Math.min(text.length, end)
  for (let i=start; i < end; i++) {
    let id = text.charAt(i)
    glyph = this.getGlyph(font, id)

    if (glyph) {
      //move pen forward
     // let xoff = glyph._x
      let kern = lastGlyph ? getKerning(font, lastGlyph.id, glyph.id) : 0
      curPen += kern

      let nextPen = curPen + glyph.xA + letterSpacing
      let nextWidth = curPen + glyph.w

      //we've hit our limit; we can't move onto the next glyph
      if (nextWidth >= width || nextPen >= width)
        break

      //otherwise continue along our line
      curPen = nextPen
      curWidth = nextWidth
      lastGlyph = glyph
    }
    count++
  }
  
  //make sure rightmost edge lines up with rendered glyphs
  if (lastGlyph)
    curWidth += lastGlyph._x || 0

  return {
    start: start,
    end: start + count,
    width: curWidth
  }
}

//getters for the private vars
;['width', 'height', 
  'descender', 'ascender',
  'xHeight', 'baseline',
  'capHeight',
  'lineHeight' ].forEach(addGetter)

function addGetter(name) {
  Object.defineProperty(TextLayout.prototype, name, {
    get: wrapper(name),
    configurable: true
  })
}

//create lookups for private vars
function wrapper(name) {
  return (new Function([
    'return function '+name+'() {',
    '  return this._'+name,
    '}'
  ].join('\n')))()
}

function getXHeight(font) {
  for (let i=0; i<X_HEIGHTS.length; i++) {
    let char = findChar(font, X_HEIGHTS[i])
    if (char) 
      return char.h || 0
  }
  return 0
}

function getMGlyph(font) {
  for (let i=0; i<M_WIDTHS.length; i++) {
     let char = findChar(font, M_WIDTHS[i]);
    if (char) 
      return char
  }
  
  if(!font.info)
    return null

  for (let i=0; i< font.info.charset.length; i++) {
    let char = findChar(font, font.info.charset[i]);
   if (char) 
     return char
 }
 
  return null
}

function getCapHeight(font) {
  for (let i=0; i<CAP_HEIGHTS.length; i++) {
     let char = findChar(font,  CAP_HEIGHTS[i])
    if (char) 
      return char.h || 0
  }
  return 0
}

function getKerning(font, left, right) {
  if (!font.kerningsMap)
    return 0

  return font.kerningsMap[`${left}-${right}`] || 0;
}

function getAlignType(align) {
  if (align === 'center')
    return ALIGN_CENTER
  else if (align === 'right')
    return ALIGN_RIGHT
  return ALIGN_LEFT
}

function findChar(font, key) {
  if (!font || !font.charsMap || !font.charsMap[key])
    return null
  
  let char = font.charsMap[key];
  if(!char.xA){
    char.xA = 0;
  }
  if(!char._x){
    char._x = 0;
  }
  if(!char._y){
    char._y = 0;
  }

  return font.charsMap[key] || null;
}


module.exports = function createLayout(opt) {
  return new TextLayout(opt)
}

module.exports.containArabic = containArabic;