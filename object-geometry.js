// Procedural, original meshes. Interleaved position(3), normal(3), UV(2), role(1).
const norm = v => { const length = Math.hypot(...v) || 1; return v.map(n => n / length); };
const sub = (a, b) => a.map((n, i) => n - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function builder() {
  const data = [];
  const vertex = (p, n, uv, role) => data.push(...p, ...n, ...uv, role);
  function tri(a, b, c, role = 0, uvs = [[0, 0], [1, 0], [1, 1]], normals = null) {
    const n = norm(cross(sub(b, a), sub(c, a)));
    [a, b, c].forEach((p, i) => vertex(p, normals ? normals[i] : n, uvs[i], role));
  }
  function quad(a, b, c, d, role = 0) { tri(a, b, c, role); tri(a, c, d, role, [[0, 0], [1, 1], [0, 1]]); }
  function extrude(poly, depth, role = 0, bevel = .045) {
    const center = poly.reduce((sum, p) => [sum[0] + p[0] / poly.length, sum[1] + p[1] / poly.length], [0, 0]);
    const inset = poly.map(p => p.map((v, i) => center[i] + (v - center[i]) * .94));
    const z = depth / 2;
    for (let i = 1; i < poly.length - 1; i++) {
      tri([...inset[0], z], [...inset[i], z], [...inset[i + 1], z], role);
      tri([...inset[0], -z], [...inset[i + 1], -z], [...inset[i], -z], role);
    }
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      quad([...poly[i], -z + bevel], [...poly[j], -z + bevel], [...poly[j], z - bevel], [...poly[i], z - bevel], role);
      quad([...poly[i], z - bevel], [...poly[j], z - bevel], [...inset[j], z], [...inset[i], z], role);
      quad([...inset[i], -z], [...inset[j], -z], [...poly[j], -z + bevel], [...poly[i], -z + bevel], role);
    }
  }
  function cylinder(radius, bottom, top, role, segments = 32, radiusTop = radius) {
    for (let i = 0; i < segments; i++) {
      const a = i / segments * Math.PI * 2, b = (i + 1) / segments * Math.PI * 2;
      const p = [Math.cos(a) * radius, bottom, Math.sin(a) * radius], q = [Math.cos(b) * radius, bottom, Math.sin(b) * radius];
      const r = [Math.cos(b) * radiusTop, top, Math.sin(b) * radiusTop], s = [Math.cos(a) * radiusTop, top, Math.sin(a) * radiusTop];
      quad(p, s, r, q, role); tri([0, bottom, 0], p, q, role); tri([0, top, 0], r, s, role);
    }
  }
  return { data, tri, quad, extrude, cylinder };
}

function sheet() {
  const mesh = builder(), nx = 32, ny = 24, thickness = .038;
  const point = (u, v, side) => {
    const x = (u * 2 - 1) * 1.14, y = (v * 2 - 1) * 1.25;
    const z = .38 * Math.sin(x * 2.1 + y * .65) + .14 * y * y;
    const n = norm([-.38 * 2.1 * Math.cos(x * 2.1 + y * .65), -.38 * .65 * Math.cos(x * 2.1 + y * .65) - .28 * y, 1]);
    return { p: [x + n[0] * thickness * side, y + n[1] * thickness * side, z + n[2] * thickness * side], n: n.map(value => value * side), uv: [u, v] };
  };
  for (const side of [1, -1]) for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) {
    const a = point(x / nx, y / ny, side), b = point((x + 1) / nx, y / ny, side), c = point((x + 1) / nx, (y + 1) / ny, side), d = point(x / nx, (y + 1) / ny, side);
    for (const verts of side === 1 ? [[a, b, c], [a, c, d]] : [[a, c, b], [a, d, c]]) mesh.tri(...verts.map(v => v.p), 0, verts.map(v => v.uv), verts.map(v => v.n));
  }
  const edge = (a, b) => mesh.quad(point(...a, 1).p, point(...b, 1).p, point(...b, -1).p, point(...a, -1).p, 0);
  for (let x = 0; x < nx; x++) { edge([x / nx, 0], [(x + 1) / nx, 0]); edge([(x + 1) / nx, 1], [x / nx, 1]); }
  for (let y = 0; y < ny; y++) { edge([0, (y + 1) / ny], [0, y / ny]); edge([1, y / ny], [1, (y + 1) / ny]); }
  return mesh;
}
function letter() {
  const mesh = builder();
  mesh.extrude([[-1.15, -1.2], [-.7, -1.2], [.16, 1.25], [-.24, 1.25]], .58);
  mesh.extrude([[.7, -1.2], [1.15, -1.2], [.24, 1.25], [-.16, 1.25]], .58);
  mesh.extrude([[-.67, -.46], [.67, -.46], [.52, -.1], [-.52, -.1]], .58);
  return mesh;
}
function lamp() {
  const mesh = builder();
  mesh.cylinder(.72, -1.27, -1.1, 3, 40);
  mesh.cylinder(.065, -1.1, -.15, 1, 20);
  mesh.cylinder(.29, -.08, .95, 2, 32, .22);
  mesh.cylinder(.43, 1.02, 1.1, 0, 40);
  // Each rib is a solid strip following a shared gently curved profile.
  for (let rib = 0; rib < 18; rib++) {
    const angle = rib / 18 * Math.PI * 2;
    const position = (t, edge, depth) => {
      const radius = .83 - .4 * t + .08 * Math.sin(t * Math.PI) + depth;
      const along = angle + edge * .025;
      return [Math.cos(along) * radius, -.1 + t * 1.16, Math.sin(along) * radius];
    };
    for (let part = 0; part < 6; part++) {
      const t = part / 6, s = (part + 1) / 6;
      const p = [position(t, -1, -.025), position(t, 1, -.025), position(s, 1, -.025), position(s, -1, -.025)];
      const q = [position(t, -1, .025), position(t, 1, .025), position(s, 1, .025), position(s, -1, .025)];
      mesh.quad(...p, 0); mesh.quad(q[3], q[2], q[1], q[0], 0);
      mesh.quad(p[0], q[0], q[1], p[1], 0); mesh.quad(p[1], q[1], q[2], p[2], 0);
      mesh.quad(p[2], q[2], q[3], p[3], 0); mesh.quad(p[3], q[3], q[0], p[0], 0);
    }
  }
  return mesh;
}
export function buildObjectGeometry(id) {
  const mesh = id === 'type' ? letter() : id === 'signal' ? lamp() : sheet();
  const vertices = new Float32Array(mesh.data);
  if (vertices.length / 9 > 30000 || vertices.some(value => !Number.isFinite(value))) throw new Error('Invalid object geometry');
  return { vertices, count: vertices.length / 9, triangles: vertices.length / 27, stride: 36 };
}
