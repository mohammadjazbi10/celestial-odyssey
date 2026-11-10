import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function RotatingPlanet({ size = 300 }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = size;
    const height = size;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 240;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Planet Sphere
    const planetRadius = 58;
    const sphereGeo = new THREE.SphereGeometry(planetRadius, 64, 64);
    
    // Draw procedural lunar / engraved planet surface matching Innovision's planet-storm & planet-moon
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Grayscale monochrome crater and band shading
    ctx.fillStyle = '#22211e';
    ctx.fillRect(0, 0, 512, 256);

    // Draw engraved lunar craters and storm ripples
    for (let i = 0; i < 40; i++) {
      const cx = (i * 37) % 512;
      const cy = 20 + ((i * 29) % 216);
      const r = 6 + (i % 5) * 5;
      
      const radGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
      radGrad.addColorStop(0, '#ECE8DF');
      radGrad.addColorStop(0.6, '#545048');
      radGrad.addColorStop(1, '#1b1a18');
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Atmospheric banding
    ctx.fillStyle = 'rgba(236, 232, 223, 0.1)';
    for (let y = 15; y < 240; y += 12) {
      ctx.fillRect(0, y, 512, 3 + (y % 6));
    }

    const texture = new THREE.CanvasTexture(canvas);
    const sphereMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.9,
      metalness: 0.05,
    });
    const planetMesh = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(planetMesh);

    // Outer Halo
    const glowGeo = new THREE.SphereGeometry(planetRadius * 1.04, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xC5A059,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glowMesh);

    // Celestial Saturn Ring (Engraved cream & gold style)
    const ringGeo = new THREE.RingGeometry(planetRadius * 1.35, planetRadius * 2.05, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xECE8DF,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2.3;
    ringMesh.rotation.y = -Math.PI / 10;
    scene.add(ringMesh);

    // Lights
    const dirLight = new THREE.DirectionalLight(0xfffaed, 2.4);
    dirLight.position.set(200, 120, 160);
    scene.add(dirLight);

    const ambientLight = new THREE.AmbientLight(0x23211e, 1.4);
    scene.add(ambientLight);

    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      planetMesh.rotation.y += 0.0035;
      ringMesh.rotation.z += 0.0018;
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      sphereGeo.dispose();
      sphereMat.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      texture.dispose();
      renderer.dispose();
    };
  }, [size]);

  return (
    <div className="relative inline-flex items-center justify-center">
      <div ref={mountRef} style={{ width: size, height: size }} />
      {/* Outer Innovision dashed orbital ring with gold dot */}
      <div 
        className="absolute pointer-events-none rounded-full border border-dashed border-[#C5A059]/40 animate-orbit"
        style={{ width: size * 1.18, height: size * 1.18 }}
      >
        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#C5A059] shadow-sm shadow-[#C5A059]" />
      </div>
    </div>
  );
}
