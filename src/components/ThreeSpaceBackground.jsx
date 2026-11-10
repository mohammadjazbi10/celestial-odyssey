import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ThreeSpaceBackground({ intensity = 1.0, interactive = true }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Scene, Camera, Renderer matching Innovision's #141312 deep space canvas
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x141312, 0.0009);

    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    camera.position.z = 650;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Starfield Layer: Warm cream, subtle gold, and soft white particles
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1400;
    const posArray = new Float32Array(starCount * 3);
    const colorArray = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      posArray[i] = (Math.random() - 0.5) * 1800;
      posArray[i + 1] = (Math.random() - 0.5) * 1800;
      posArray[i + 2] = (Math.random() - 0.5) * 1600;

      const choice = Math.random();
      if (choice < 0.6) {
        // Warm ivory / cream (#ECE8DF)
        colorArray[i] = 0.92;
        colorArray[i + 1] = 0.91;
        colorArray[i + 2] = 0.87;
      } else if (choice < 0.85) {
        // Celestial warm gold (#C5A059)
        colorArray[i] = 0.77;
        colorArray[i + 1] = 0.63;
        colorArray[i + 2] = 0.35;
      } else {
        // Crisp starlight white
        colorArray[i] = 1.0;
        colorArray[i + 1] = 1.0;
        colorArray[i + 2] = 1.0;
      }
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

    const starMat = new THREE.PointsMaterial({
      size: 2.0,
      vertexColors: true,
      transparent: true,
      opacity: 0.85 * intensity,
      blending: THREE.AdditiveBlending
    });

    const starMesh = new THREE.Points(starGeo, starMat);
    scene.add(starMesh);

    // Vintage Celestial Orbital Rings (like the ones circling the Innovision disc)
    const ringGeo1 = new THREE.RingGeometry(220, 221.2, 96);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0xECE8DF,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.12 * intensity
    });
    const ringMesh1 = new THREE.Mesh(ringGeo1, ringMat1);
    ringMesh1.rotation.x = Math.PI / 2.8;
    scene.add(ringMesh1);

    const ringGeo2 = new THREE.RingGeometry(340, 341.2, 128);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0xC5A059,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.1 * intensity
    });
    const ringMesh2 = new THREE.Mesh(ringGeo2, ringMat2);
    ringMesh2.rotation.x = Math.PI / 2.4;
    ringMesh2.rotation.y = Math.PI / 10;
    scene.add(ringMesh2);

    // Subtle Parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const onMouseMove = (e) => {
      if (!interactive) return;
      mouseX = (e.clientX - window.innerWidth / 2) * 0.04;
      mouseY = (e.clientY - window.innerHeight / 2) * 0.04;
    };

    window.addEventListener('mousemove', onMouseMove);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix;
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', onResize);

    let animationId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      targetX += (mouseX - targetX) * 0.02;
      targetY += (mouseY - targetY) * 0.02;
      camera.position.x = targetX;
      camera.position.y = -targetY;
      camera.lookAt(scene.position);

      starMesh.rotation.y = elapsedTime * 0.012;
      starMesh.rotation.x = elapsedTime * 0.004;
      ringMesh1.rotation.z = elapsedTime * 0.025;
      ringMesh2.rotation.z = -elapsedTime * 0.018;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      starGeo.dispose();
      starMat.dispose();
      ringGeo1.dispose();
      ringMat1.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      renderer.dispose();
    };
  }, [intensity, interactive]);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 50% 45%, #1d1b19 0%, #141312 85%)'
      }}
    />
  );
}
