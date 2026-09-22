import * as THREE from 'three';

export class PSKLoader {
  async loadAsync(url, signal) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`PSK request failed (${response.status}): ${url}`);
    return this.parse(await response.arrayBuffer());
  }

  parse(buffer) {
    const view = new DataView(buffer);
    const text = (offset, length) => new TextDecoder().decode(new Uint8Array(buffer, offset, length)).split('\0')[0];
    const fail = message => { throw new Error(`Invalid PSK: ${message}`); };
    const chunks = new Map();
    for (let at = 0; at < buffer.byteLength;) {
      if (at + 32 > buffer.byteLength) fail('truncated chunk header');
      const name = text(at, 20);
      const size = view.getInt32(at + 24, true), count = view.getInt32(at + 28, true);
      const end = at + 32 + size * count;
      if (size < 0 || count < 0 || end > buffer.byteLength || (count && !size)) fail(`invalid ${name} length`);
      if (chunks.has(name)) fail(`duplicate ${name} chunk`);
      if (at === 0 && name !== 'ACTRHEAD') fail('missing ActorX header');
      chunks.set(name, { offset: at + 32, size, count });
      at = end;
    }
    const required = (name, size) => {
      const chunk = chunks.get(name);
      if (!chunk || !chunk.count || chunk.size !== size) fail(`missing or unsupported ${name}`);
      return chunk;
    };
    const points = required('PNTS0000', 12);
    const wedges = required('VTXW0000', 16);
    const wideFaces = chunks.has('FACE3200');
    const faces = required(wideFaces ? 'FACE3200' : 'FACE0000', wideFaces ? 18 : 12);
    const materials = required('MATT0000', 88);
    const normals = chunks.get('VTXNORMS');
    if (normals && (normals.size !== 12 || normals.count !== points.count)) fail('invalid normal count');
    const positionData = new Float32Array(points.count * 3);
    const normalData = new Float32Array(points.count * 3);
    function vector(chunk, i, target) {
      const at = chunk.offset + i * 12;
      target[i * 3] = view.getFloat32(at, true);
      target[i * 3 + 1] = view.getFloat32(at + 8, true);
      target[i * 3 + 2] = -view.getFloat32(at + 4, true);
      if (![target[i * 3], target[i * 3 + 1], target[i * 3 + 2]].every(Number.isFinite)) fail('non-finite vector');
    }
    for (let i = 0; i < points.count; i++) {
      vector(points, i, positionData);
      if (normals) vector(normals, i, normalData);
    }
    const pointIndices = new Uint32Array(wedges.count);
    const wedgeUV = new Float32Array(wedges.count * 2);
    for (let i = 0; i < wedges.count; i++) {
      const at = wedges.offset + i * 16;
      const point = points.count > 65536 ? view.getUint32(at, true) : view.getUint16(at, true);
      if (point >= points.count) fail('wedge point index out of bounds');
      pointIndices[i] = point;
      wedgeUV[i * 2] = view.getFloat32(at + 4, true);
      wedgeUV[i * 2 + 1] = view.getFloat32(at + 8, true);
      if (!Number.isFinite(wedgeUV[i * 2]) || !Number.isFinite(wedgeUV[i * 2 + 1])) fail('non-finite UV');
    }
    const buckets = Array.from({ length: materials.count }, () => []);
    let orientation = 0;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), cross = new THREE.Vector3();
    for (let i = 0; i < faces.count; i++) {
      const at = faces.offset + i * faces.size;
      const indices = [0, 1, 2].map(j => wideFaces ? view.getUint32(at + j * 4, true) : view.getUint16(at + j * 2, true));
      if (indices.some(index => index >= wedges.count)) fail('face wedge index out of bounds');
      const material = view.getUint8(at + (wideFaces ? 12 : 6));
      if (material >= materials.count) fail('face material index out of bounds');
      buckets[material].push(indices);
      const vertices = indices.map(index => pointIndices[index]);
      a.fromArray(positionData, vertices[0] * 3);
      b.fromArray(positionData, vertices[1] * 3).sub(a);
      c.fromArray(positionData, vertices[2] * 3).sub(a);
      cross.crossVectors(b, c);
      if (normals) orientation += cross.dot(a.fromArray(normalData, vertices[0] * 3));
      else for (const point of vertices) {
        normalData[point * 3] += cross.x;
        normalData[point * 3 + 1] += cross.y;
        normalData[point * 3 + 2] += cross.z;
      }
    }
    const positions = new Float32Array(faces.count * 9);
    const vertexNormals = new Float32Array(faces.count * 9);
    const uv = new Float32Array(faces.count * 6);
    const geometry = new THREE.BufferGeometry();
    let vertex = 0;
    for (let material = 0; material < buckets.length; material++) {
      const start = vertex;
      for (const original of buckets[material]) {
        const face = orientation < 0 ? [original[0], original[2], original[1]] : original;
        for (const wedge of face) {
          const point = pointIndices[wedge];
          positions.set(positionData.subarray(point * 3, point * 3 + 3), vertex * 3);
          a.fromArray(normalData, point * 3).normalize().toArray(vertexNormals, vertex * 3);
          uv.set(wedgeUV.subarray(wedge * 2, wedge * 2 + 2), vertex * 2);
          vertex++;
        }
      }
      if (vertex > start) geometry.addGroup(start, vertex - start, material);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(vertexNormals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const slots = Array.from({ length: materials.count }, (_, i) => {
      const material = new THREE.MeshStandardMaterial();
      material.name = text(materials.offset + i * 88, 64);
      return material;
    });
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(geometry, slots));
    scene.userData.psk = { points: points.count, triangles: faces.count, bones: chunks.get('REFSKELT')?.count || 0,
      materials: slots.map(material => material.name), pose: 'reference' };
    return { scene };
  }
}
