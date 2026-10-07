// 本生灯火焰的体积着色器：在一个包围圆柱里做光线步进，密度场 = 锥形火焰轮廓 × 上升的分形噪声。
// 两层结构：内焰（蓝色锥，预混燃烧）+ 外焰（几乎不可见的淡蓝，样品蒸气在这里被激发发光）。
// uTint 是样品焰色（由光谱模型算出），uTintAmt 是被染色的程度；铂丝伸进火焰处染色最浓（uWire）。
// 加性混合：火焰只发光不遮挡，背景透过来，正是真实火焰的样子。

export const FLAME_VERT = /* glsl */ `
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

export const FLAME_FRAG = /* glsl */ `
  uniform float uTime, uTintAmt, uPower, uFlicker;
  uniform vec3 uTint, uWire, uCam;
  varying vec3 vLocal;

  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }

  // 火焰局部坐标：底部 y=0，高 H，底半径 R。返回 (外焰密度, 内焰密度)
  const float H = 1.0, R = 0.13;
  vec2 density(vec3 p) {
    float h = p.y / H;
    if (h < 0.0 || h > 1.0) return vec2(0.0);
    vec3 q = vec3(p.x, p.y - uTime * 1.6, p.z) * 7.0;
    float n = fbm(q);
    // 摇曳：越往上横向偏移越大
    vec2 sway = vec2(sin(uTime * 3.1 + p.y * 6.0), cos(uTime * 2.3 + p.y * 5.0)) * 0.018 * h * h * uFlicker;
    float r = length(p.xz - sway);
    float outerR = R * (1.0 - pow(h, 1.6)) * (0.75 + 0.5 * n) + 0.01;
    float outer = smoothstep(outerR, outerR * 0.55, r) * smoothstep(1.0, 0.4, h + (n - 0.5) * 0.35);
    float innerH = 0.38;
    float innerR = R * 0.62 * (1.0 - h / innerH);
    float inner = h < innerH ? smoothstep(innerR, innerR - 0.02, r) * smoothstep(innerR - 0.035, innerR - 0.015, r) : 0.0;
    return vec2(outer, inner);
  }

  void main() {
    vec3 ro = uCam;
    vec3 rd = normalize(vLocal - uCam);
    // 与包围圆柱求交 → 在区间内等步长步进
    float a = dot(rd.xz, rd.xz), b = dot(ro.xz, rd.xz), c = dot(ro.xz, ro.xz) - 0.04;
    float disc = b * b - a * c;
    if (disc < 0.0) discard;
    float sq = sqrt(disc);
    float t0 = max((-b - sq) / a, 0.0), t1 = (-b + sq) / a;
    const int STEPS = 40;
    float dt = (t1 - t0) / float(STEPS);
    vec3 col = vec3(0.0);
    vec3 base = vec3(0.25, 0.45, 1.0);
    for (int i = 0; i < STEPS; i++) {
      vec3 p = ro + rd * (t0 + (float(i) + 0.5) * dt);
      vec2 d = density(p);
      if (d.x + d.y < 0.001) continue;
      // 铂丝附近蒸气最浓，染色在铂丝上方形成一条更亮的羽流
      float plume = exp(-dot(p.xz - uWire.xz, p.xz - uWire.xz) * 160.0) * smoothstep(uWire.y - 0.05, uWire.y + 0.05, p.y);
      float tint = clamp(uTintAmt * (0.55 + 1.6 * plume), 0.0, 1.0);
      vec3 outerCol = mix(base * 0.35, uTint * 1.6, tint);
      col += (outerCol * d.x * (0.6 + 1.4 * tint) + vec3(0.35, 0.6, 1.4) * d.y * 3.0) * dt * 18.0;
    }
    col *= uPower;
    if (max(col.r, max(col.g, col.b)) < 0.004) discard;
    gl_FragColor = vec4(col, 1.0);
  }`;
