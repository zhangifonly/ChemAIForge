// 水面着色器。顶点：环境微波 + 钠球持续激起的同心涟漪 + 入水冲击波；
// 片元：屏幕导数求法线 → 菲涅尔 + 高光；颜色在清水与酚酞粉红之间按局部 NaOH 浓度插值。

export const WATER_VERT = /* glsl */ `
  uniform float uTime, uAmp, uSplash, uBallR;
  uniform vec2 uBall;
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vec3 p = position;
    float d = distance(p.xy, uBall);
    // 球附近不起波（被球体占住），向外指数衰减
    float near = smoothstep(uBallR * 0.8, uBallR * 2.0, d);
    float ripple = sin(d * 42.0 - uTime * 16.0) * exp(-d * 2.2) * near * uAmp * 0.018;
    // 入水冲击：一圈向外扩散的大波，uSplash 由 1 衰减到 0，波前半径随之变大
    float front = (1.0 - uSplash) * 1.6;
    float ring = exp(-pow((d - front) * 9.0, 2.0)) * uSplash * 0.035;
    float ambient = (sin(p.x * 5.0 + uTime * 0.8) + sin(p.y * 4.3 - uTime * 0.6)) * 0.0015;
    p.z += ripple + ring + ambient;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vWorld = w.xyz;
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

export const WATER_FRAG = /* glsl */ `
  uniform sampler2D uDye;
  uniform float uPinkAll, uPhenol;
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    if (n.y < 0.0) n = -n;
    vec3 v = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    vec3 l = normalize(vec3(0.5, 1.0, 0.4));
    float spec = pow(max(dot(reflect(-l, n), v), 0.0), 90.0);

    float local = texture2D(uDye, vUv).r;
    // 局部浓度饱和得很快：钠球刚经过的地方 pH 已远高于酚酞变色点
    float pink = clamp(uPinkAll * 0.75 + smoothstep(0.0, 0.35, local) * 0.9, 0.0, 1.0) * uPhenol;
    vec3 clear = vec3(0.62, 0.76, 0.82);
    vec3 magenta = vec3(0.93, 0.22, 0.55);
    vec3 col = mix(clear, magenta, pink);
    // 假环境反射：反射向量朝上映出明亮的天花板灯，朝下映出暗台面 —— 涟漪靠它显形
    vec3 rv = reflect(-v, n);
    vec3 env = mix(vec3(0.22, 0.25, 0.28), vec3(0.96, 0.97, 1.0), smoothstep(0.05, 0.75, rv.y));
    col = mix(col, env, fres * 0.75) + spec * 0.9;
    float alpha = clamp(0.14 + pink * 0.5 + fres * 0.6 + spec, 0.0, 0.96);
    gl_FragColor = vec4(col, alpha);
  }`;
