import * as THREE from "three";
import CreateIndices from "quad-indices";

import CreateLayout from "./index";

const DEFAULT_MAX_CHARS = 0;
const DEFAULT_SCALE = 1024;
const DEFAULT_NODE_SIZE =  1.0;
export default class MSDFGeometry extends THREE.BufferGeometry {
  constructor(props) {
    super();
    this.font = props.font;
    this.texture = props.texture;
    this.texts = props.texts;
    this.layouts = null
    this.width = props.width || 560;
    this.align = props.align || "left"; // left, center, right
    this.position = props.position || "center"; // top, center, bottom
    this.textAlign = props.textAlign || "left"; // left, center, right ;

    this.marginLeft = props.marginLeft || 0
    this.marginTop= props.marginTop || 0
    let charNumbers = this.getCharNumbers(this.texts)
    this.scale = props.scale
    this.allocateMemory(charNumbers)
    this.update(this.texts);
  }

  getCharNumbers(texts) {
    if (!texts || texts.length == 0) {
      return DEFAULT_MAX_CHARS
    }

    return texts.reduce((total, text) => {
      return total + text.text.length
    }, 0)
  }

  allocateMemory(charNumbers) {
    if (!charNumbers) {
      return
    }
    let indices = new CreateIndices({
      clockwise: true,
      type: "uint16",
      count: charNumbers
    });
    let positions = new Float32Array(charNumbers * 4 * 3);
    let nodePositions = new Float32Array(charNumbers * 4 * 3);
    let uvs = new Float32Array(charNumbers * 4 * 2);
    let opacity = new Float32Array(charNumbers * 4 * 1);
    let rotation = new Float32Array(charNumbers * 4 * 1);
    let quaternion = new Float32Array(charNumbers * 4 * 4);

    let indexAttr = new THREE.BufferAttribute(indices,1,false)
    let positionAttr = new THREE.BufferAttribute(positions,3,false)
    let nodePositionsAttr = new THREE.BufferAttribute(nodePositions,3,false)
    let uvsAttr = new THREE.BufferAttribute(uvs,2,false)
    let opacityAttr = new THREE.BufferAttribute(opacity,1,false)
    let rotationAttr = new THREE.BufferAttribute(rotation,1,false)
    let quaternionAttr = new THREE.BufferAttribute(quaternion,4,false)

    this.setIndex(indexAttr)
    this.setAttribute("position",positionAttr)
    this.setAttribute("nodePosition",nodePositionsAttr)
    this.setAttribute("uv",uvsAttr)
    this.setAttribute("opacity",opacityAttr)
    this.setAttribute("rotation",rotationAttr)
    this.setAttribute("quaternion",quaternionAttr)
  }

  clear() {
    this.index ? this.index.array.fill(0) : null
    this.attributes.position ? this.attributes.position.array.fill(0) : null
    this.attributes.nodePosition ? this.attributes.nodePosition.array.fill(0) : null
    this.attributes.opacity ? this.attributes.opacity.array.fill(0) : null
    this.attributes.uv ? this.attributes.uv.array.fill(0) : null
    this.attributes.rotation ? this.attributes.rotation.array.fill(0) : null
    this.attributes.quaternion ? this.attributes.quaternion.array.fill(0) : null
    if (this.index) {
      this.index.needsUpdate = true
      this.attributes.position.needsUpdate = true
      this.attributes.nodePosition.needsUpdate = true
      this.attributes.opacity.needsUpdate = true
      this.attributes.uv.needsUpdate = true
      this.attributes.rotation.needsUpdate = true
      this.attributes.quaternion.needsUpdate = true
      this.verticesNeedUpdate = true
    }
  }

  setScale(scale) {
    this.scale = scale
  }

  setAlign(align){
    this.align = align;
  }

  setTextAlign(textAlign) {
    this.textAlign = textAlign || this.align ;
  }

  setTextPosition(position){
    this.position = position
  }

  update(texts = []) {
    this.texts = texts.filter(text => text.text != "")
    let charNumbers = this.getCharNumbers(texts)
    if (charNumbers == 0) {
      this.charNumbers = 0
      this.clear()
      return
    }

    this.layouts = this.texts.map((text, idx) => {
      
      let opt = { 
        font: this.font, 
        text: text.text, 
        align: this.textAlign,
        width: this.width
      };
      let layout = CreateLayout(opt);
      layout.x = text.x
      layout.y = text.y
      layout.z = text.z
      layout.opacity = text.opacity
      layout.nodeSize = text.nodeSize
      layout.angle = text.angle
      layout.angleXZ = text.angleXZ
      layout.quaternion = text.quaternion
      return layout;
    });
    if (charNumbers != this.charNumbers) {
      this.allocateMemory(charNumbers)
      this.charNumbers = charNumbers
    }

    let texWidth = this.font.common.scaleW;
    let texHeight = this.font.common.scaleH;

    this.getUvs(this.layouts, texWidth, texHeight, true);
    this.getPositions(this.layouts);
    this.getNodePositions(this.layouts)
    this.getOpacity(this.layouts)
    this.getRotation(this.layouts)
    this.getQuaternion(this.layouts)

    this.index.needsUpdate = true
    this.attributes.position.needsUpdate = true
    this.attributes.nodePosition.needsUpdate = true
    this.attributes.opacity.needsUpdate = true
    this.attributes.uv.needsUpdate = true
    this.attributes.rotation.needsUpdate = true
    this.attributes.quaternion.needsUpdate = true
    this.verticesNeedUpdate = true

  }


  getIndices(layouts) {

    let indices = this.indices
    let length = layouts.reduce((total, layout) => {
      return total + layout.glyphs.length;
    }, 0);
    if (length * 3 * 2 != this.indices.length) {
      indices = CreateIndices({
        clockwise: true,
        type: "uint16",
        count: length
      });
    }
    return indices
  }

  getUvs(layouts, texWidth, texHeight, flipY) {
    let glyphs = layouts.reduce((total, layout) => {
      return total.concat(layout.glyphs);
    }, []);
    let uvs = this.attributes.uv.array;
    let i = 0;
    glyphs.forEach(function (glyph) {
      let bitmap = glyph.data;
      let bw = bitmap.x + bitmap.w;
      let bh = bitmap.y + bitmap.h;

      // top left position
      let u0 = bitmap.x / texWidth;
      let v1 = bitmap.y / texHeight;
      let u1 = bw / texWidth;
      let v0 = bh / texHeight;

      if (flipY) {
        v1 = (texHeight - bitmap.y) / texHeight;
        v0 = (texHeight - bh) / texHeight;
      }

      // BL
      uvs[i++] = u0;
      uvs[i++] = v1;
      // TL
      uvs[i++] = u0;
      uvs[i++] = v0;
      // TR
      uvs[i++] = u1;
      uvs[i++] = v0;
      // BR
      uvs[i++] = u1;
      uvs[i++] = v1;
    });
    return uvs;
  }

  getRotation(layouts) {
    let rotation = this.attributes.rotation.array;
    let i = 0;
    layouts.forEach(layout => {
      layout.glyphs.forEach(function (glyph) {

        let r = layout.angle?layout.angle:0;
        rotation[i++] = r;
        rotation[i++] = r;
        rotation[i++] = r;
        rotation[i++] = r;
      });
    });
    return rotation;
  }

  getQuaternion(layouts) {
    let rotation = this.attributes.quaternion.array;
    let i = 0;
    layouts.forEach(layout => {
      layout.glyphs.forEach(function (glyph) {

        let r = layout.quaternion?layout.quaternion:0;

        rotation[i++] = r.x?r.x:0;
        rotation[i++] = r.y?r.y:0;
        rotation[i++] = r.z?r.z:0;
        rotation[i++] = r.w?r.w:0;

        rotation[i++] = r.x?r.x:0;
        rotation[i++] = r.y?r.y:0;
        rotation[i++] = r.z?r.z:0;
        rotation[i++] = r.w?r.w:0;

        rotation[i++] = r.x?r.x:0;
        rotation[i++] = r.y?r.y:0;
        rotation[i++] = r.z?r.z:0;
        rotation[i++] = r.w?r.w:0;

        rotation[i++] = r.x?r.x:0;
        rotation[i++] = r.y?r.y:0;
        rotation[i++] = r.z?r.z:0;
        rotation[i++] = r.w?r.w:0;

      });
    });
    return rotation;
  }

  getOpacity(layouts) {
    let opacity = this.attributes.opacity.array;
    let i = 0;
    layouts.forEach(layout => {
      layout.glyphs.forEach(function (glyph) {

        let alpha = layout.opacity;
        // BL
        opacity[i++] = alpha;
        // TL
        opacity[i++] = alpha;
        // TR
        opacity[i++] = alpha;
        // BR
        opacity[i++] = alpha;
      });
    });
    return opacity;
  }

  getNodePositions(layouts) {
    let positions = this.attributes.nodePosition.array;
    let i = 0;
    layouts.forEach((layout, idx) => {
      layout.glyphs.forEach(function (glyph) {

        let x = layout.x;
        let y = layout.y;
        let z = layout.z;
        // BL
        positions[i++] = x;
        positions[i++] = y;
        positions[i++] = z;
        // TL
        positions[i++] = x;
        positions[i++] = y;
        positions[i++] = z;
        // TR
        positions[i++] = x;
        positions[i++] = y;
        positions[i++] = z;
        // BR
        positions[i++] = x;
        positions[i++] = y;
        positions[i++] = z;
      });
    });
    return positions;
  }

  getPositions(layouts) {

    let positions = this.attributes.position.array;
    let i = 0;
    let scale = this.scale;
    layouts.forEach(layout => {
      let textHeight  = layout._height
      layout.glyphs.forEach((glyph)=> {
        let bitmap = glyph.data;

        let offsetX = 0;
        let offsetY = 0
        if(this.position == "right" || this.position == "left" || this.position == "center") {
          offsetY = textHeight /2
        }else if(this.position == "bottom"){
          offsetY = textHeight 
        }else if(this.position == "top"){
          offsetY = 0;
        } 

        if(this.align == "center") {
          offsetX = - layout._width / 2;
        }else if(this.align == "right") {
          offsetX = 0;
        }else if(this.align == "left") {
          offsetX = -layout._width;
        }
       

        let x = (glyph.position[0] + bitmap._x + offsetX) / DEFAULT_SCALE * scale + this.marginLeft;
        let y = (glyph.position[1] + bitmap._y + offsetY ) / DEFAULT_SCALE * scale + this.marginTop;
        let z = 0

        // quad size
        let w = bitmap.w / DEFAULT_SCALE * scale;
        let h = bitmap.h / DEFAULT_SCALE * scale;

        // BL
        positions[i++] = x;
        positions[i++] = y;
        positions[i++] = z;

        // TL
        positions[i++] = x;
        positions[i++] = y + h;
        positions[i++] = z;
        // TR
        positions[i++] = x + w;
        positions[i++] = y + h;
        positions[i++] = z;

        // BR
        positions[i++] = x + w;
        positions[i++] = y;
        positions[i++] = z;

      });
    });
    this.positions = positions
    return positions;
  }
}
