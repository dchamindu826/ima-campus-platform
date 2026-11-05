import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Maximize2, RefreshCw, Sliders, Play, Pause } from 'lucide-react';

export default function SDFLiquidMetalCanvas({ 
  className = "w-full h-full min-h-[400px]", 
  isReelRatio = true,
  speed = 1.0,
  neonColorA = [0.0, 1.0, 1.0], // Cyan
  neonColorB = [1.0, 0.0, 0.8]  // Neon Pink
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error("WebGL not supported on this device/browser.");
      return;
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    window.addEventListener('resize', resize);
    resize();

    const vs = `
      attribute vec2 p;
      void main() {
        gl_Position = vec4(p, 0.0, 1.0);
      }
    `;

    const fs = `
      precision highp float;
      uniform vec2 r;
      uniform float t;
      uniform vec3 colA;
      uniform vec3 colB;
      
      // Smooth Minimum (Liquid Blend function)
      float smin(float a, float b, float k) {
          float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
          return mix(b, a, h) - k * h * (1.0 - h);
      }
      
      mat2 rot(float a) { float s=sin(a), c=cos(a); return mat2(c,-s,s,c); }
      
      // Scene Map
      float map(vec3 p) {
          vec3 p1 = p; vec3 p2 = p; vec3 p3 = p;
          
          // Animate spheres
          p1.x += sin(t) * 1.5; p1.y += cos(t * 1.3) * 1.5;
          p2.x += cos(t * 1.1) * 1.5; p2.y += sin(t * 0.8) * 1.5;
          p3.z += sin(t * 1.5) * 1.5;
          
          float d1 = length(p1) - 1.0;
          float d2 = length(p2) - 0.8;
          float d3 = length(p3) - 1.2;
          
          // Blend them together like liquid
          return smin(smin(d1, d2, 0.5), d3, 0.5);
      }
      
      // Calculate Normals for Reflection
      vec3 calcNormal(vec3 p) {
          vec2 e = vec2(0.01, 0.0);
          return normalize(vec3(map(p+e.xyy)-map(p-e.xyy), map(p+e.yxy)-map(p-e.yxy), map(p+e.yyx)-map(p-e.yyx)));
      }

      void main() {
          vec2 uv = (gl_FragCoord.xy * 2.0 - r.xy) / r.y;
          vec3 ro = vec3(0.0, 0.0, -5.0);
          vec3 rd = normalize(vec3(uv, 1.0));
          
          float d = 0.0;
          vec3 p;
          
          // Raymarching
          for(int i=0; i<80; i++) {
              p = ro + rd * d;
              float dist = map(p);
              if(dist < 0.001 || d > 20.0) break;
              d += dist;
          }
          
          vec3 col = vec3(0.02, 0.03, 0.05); // Ambient background
          
          if(d < 20.0) {
              vec3 n = calcNormal(p);
              
              // Light source
              vec3 lightPos = vec3(sin(t)*5.0, 5.0, cos(t)*5.0);
              vec3 l = normalize(lightPos - p);
              vec3 ref = reflect(rd, n);
              
              float diff = max(dot(n, l), 0.0);
              float spec = pow(max(dot(ref, l), 0.0), 32.0); // High specularity for chrome metal
              float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
              
              // Cyberpunk Neon Lighting
              vec3 envLight = mix(colA, colB, n.y * 0.5 + 0.5);
              
              col = envLight * fresnel + vec3(1.0) * spec + vec3(0.1) * diff;
          }
          
          gl_FragColor = vec4(col, 1.0);
      }
    `;

    function createShader(glCtx, type, src) {
      const s = glCtx.createShader(type);
      glCtx.shaderSource(s, src);
      glCtx.compileShader(s);
      if (!glCtx.getShaderParameter(s, glCtx.COMPILE_STATUS)) {
        console.error("Shader compile error:", glCtx.getShaderInfoLog(s));
      }
      return s;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, createShader(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, createShader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const pos = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const locT = gl.getUniformLocation(prog, "t");
    const locR = gl.getUniformLocation(prog, "r");
    const locColA = gl.getUniformLocation(prog, "colA");
    const locColB = gl.getUniformLocation(prog, "colB");

    gl.uniform3f(locColA, neonColorA[0], neonColorA[1], neonColorA[2]);
    gl.uniform3f(locColB, neonColorB[0], neonColorB[1], neonColorB[2]);

    let startTime = performance.now();
    let isRunning = true;

    function render(currentTime) {
      if (!isRunning) return;
      const elapsedTime = (currentTime - startTime) * 0.001 * speed;
      gl.uniform2f(locR, canvas.width, canvas.height);
      gl.uniform1f(locT, elapsedTime);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animFrameRef.current = requestAnimationFrame(render);
    }

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      window.removeEventListener('resize', resize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [speed, neonColorA, neonColorB]);

  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-3xl bg-black ${className}`}>
      <div className={`relative ${isReelRatio ? 'w-full max-w-[400px] aspect-[9/16] shadow-2xl rounded-3xl overflow-hidden border border-white/10' : 'w-full h-full'}`}>
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  );
}
