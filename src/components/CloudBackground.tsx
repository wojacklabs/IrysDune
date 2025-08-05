import React, { useEffect, useRef } from 'react';

interface CloudBackgroundProps {
  weatherState: 'clear' | 'stormy';
}

const CloudBackground: React.FC<CloudBackgroundProps> = ({ weatherState }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const cloudParticlesRef = useRef<any[]>([]);
  const flashRef = useRef<any>(null);
  const rainRef = useRef<any>(null);
  const starsRef = useRef<any>(null);
  const animationIdRef = useRef<number | undefined>(undefined);
  const weatherStateRef = useRef<'clear' | 'stormy'>(weatherState);
  const texturesRef = useRef<{ clear: any; stormy: any }>({ clear: null, stormy: null });
  const animationStartedRef = useRef<boolean>(false);

  useEffect(() => {
    let THREE: any;
    let mounted = true;
    
    const initScene = async () => {
      if (!mountRef.current) return;
      
      try {
        // Dynamic import of Three.js
        console.log('Starting Three.js import...');
        THREE = await import('three');
        console.log('Three.js imported successfully');
        
        if (!mounted) {
          console.log('Component unmounted during Three.js import');
          return;
        }
      
      // Constants
      const rainCount = 1000;

      // Scene setup
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Create scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Create camera - looking at clouds
      const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
      camera.position.set(0, 0, 0);      // Camera at origin
      camera.lookAt(0, -100, -500);      // Look down at clouds
      cameraRef.current = camera;
      
      console.log('Camera positioned at:', camera.position);
      console.log('Camera looking at: 0, -100, -500');

      // Create renderer
      const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      rendererRef.current = renderer;
      
      // Create gradient sky background based on weather
      const setupSkyBackground = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        
        if (context) {
          const gradient = context.createLinearGradient(0, 0, 0, 128);
          
          if (weatherState === 'stormy') {
            // Midnight sky gradient for stormy weather
            gradient.addColorStop(0, '#000000');     // Pure black at top
            gradient.addColorStop(0.3, '#020617');   // Very dark blue
            gradient.addColorStop(0.6, '#0a0f1f');   // Midnight blue
            gradient.addColorStop(0.8, '#0f1729');   // Slightly lighter
            gradient.addColorStop(1, '#1a2341');     // Horizon
          } else {
            // Clear blue sky
            gradient.addColorStop(0, '#4A90E2');     // Deep blue at top
            gradient.addColorStop(0.5, '#87CEEB');   // Sky blue in middle
            gradient.addColorStop(0.8, '#B0E0E6');   // Powder blue
            gradient.addColorStop(1, '#E0F6FF');     // Light blue at horizon
          }
          
          context.fillStyle = gradient;
          context.fillRect(0, 0, 1, 128);
        }
        
        const skyTexture = new THREE.CanvasTexture(canvas);
        skyTexture.mapping = THREE.EquirectangularReflectionMapping;
        
        scene.background = skyTexture;
        scene.fog = new THREE.FogExp2(weatherState === 'stormy' ? 0x0a0f1f : 0xB0E0E6, 0.0005);
      };
      
      // Set sky once
      setupSkyBackground();

      // Lighting
      const ambient = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambient);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(0, 1, 0.5);
      scene.add(directionalLight);
      
      // Lightning flash effect (initially hidden)
      const flash = new THREE.PointLight(0xFFFFFF, 30, 500, 1.7); // White lightning
      flash.position.set(200, 300, 100);
      flash.power = 0;
      scene.add(flash);
      flashRef.current = flash;
      
      // Additional purple flash for dramatic effect
      const flash2 = new THREE.PointLight(0x9B59B6, 20, 400, 1.5); // Purple tint
      flash2.position.set(-200, 250, 50);
      flash2.power = 0;
      scene.add(flash2);
      flashRef.current.secondary = flash2;

      // Create rain effect
      const rainGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(rainCount * 3);
      const velocities = new Float32Array(rainCount);
      
      for (let i = 0; i < rainCount; i++) {
        positions[i * 3] = Math.random() * 600 - 300;     // x
        positions[i * 3 + 1] = Math.random() * 500 - 250; // y
        positions[i * 3 + 2] = Math.random() * 400 - 200; // z
        velocities[i] = 0;
      }
      
      rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      rainGeo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1));
      
      const rainMaterial = new THREE.PointsMaterial({
        color: 0xaaaaaa,
        size: 0.5,
        transparent: true,
        opacity: 0
      });
      
      const rain = new THREE.Points(rainGeo, rainMaterial);
      scene.add(rain);
      rainRef.current = rain;

      // Create stars for night sky
      const starsCount = 3000;
      const starsGeo = new THREE.BufferGeometry();
      const starsPositions = new Float32Array(starsCount * 3);
      const starsColors = new Float32Array(starsCount * 3);
      const starsSizes = new Float32Array(starsCount);
      
      for (let i = 0; i < starsCount; i++) {
        // Distribute stars in a sphere around the scene (closer to camera)
        const radius = 300 + Math.random() * 500;  // Reduced from 1000-2000 to 300-800
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        
        starsPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        starsPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        starsPositions[i * 3 + 2] = radius * Math.cos(phi) - 300;  // Move stars forward
        
        // Vary star brightness and slight color tint
        const brightness = 0.5 + Math.random() * 0.5;
        starsColors[i * 3] = brightness;
        starsColors[i * 3 + 1] = brightness;
        starsColors[i * 3 + 2] = brightness + Math.random() * 0.1; // Slight blue tint
        
        // Vary star sizes (minimal variation for consistent small stars)
        starsSizes[i] = 0.1 + Math.random() * 0.05;  // Ultra small size: 0.1-0.15
      }
      
      starsGeo.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
      starsGeo.setAttribute('color', new THREE.BufferAttribute(starsColors, 3));
      starsGeo.setAttribute('size', new THREE.BufferAttribute(starsSizes, 1));
      
      const starsMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.3,  // Ultra small star size
        sizeAttenuation: false,  // Keep constant size regardless of distance
        transparent: true,
        opacity: weatherState === 'stormy' ? 0.8 : 0,
        blending: THREE.AdditiveBlending
      });
      
      const stars = new THREE.Points(starsGeo, starsMaterial);
      scene.add(stars);
      starsRef.current = stars;

      // Animation setup
      let frameCount = 0;
      
      const animate = () => {
        if (!mounted || !renderer || !scene || !camera) {
          console.error('Animation stopped: missing renderer, scene, or camera');
          animationStartedRef.current = false;
          return;
        }
        
        animationIdRef.current = requestAnimationFrame(animate);

        // Animate clouds flowing across the sky
        const time = Date.now();
        frameCount++;
        
        // Log animation status
                  if (frameCount === 1) {
            console.log('Animation started with', cloudParticlesRef.current.length, 'clouds');
            console.log('Renderer domElement:', renderer.domElement);
          }
        
        cloudParticlesRef.current.forEach((cloud) => {
          // Very gentle rotation
          cloud.rotation.z -= 0.0001;
          
          // Horizontal drift
          const speed = cloud.userData?.speed || 1;
          cloud.position.x += speed;
          

          
          // Vertical floating motion
          cloud.position.y += Math.sin(time * cloud.userData.floatSpeed + cloud.userData.floatOffset) * 0.05;
          
          // Wrap around when cloud exits screen
          if (cloud.position.x > 800) {
            cloud.position.x = -800;
            cloud.position.y = -50 - Math.random() * 150;
            cloud.position.z = -200 - Math.random() * 300;
            
            // Randomize scale when respawning
            const scale = 0.8 + Math.random() * 0.4;
            cloud.scale.set(scale * 1.5, scale, 1);
            
            // Randomize opacity
            cloud.material.opacity = 0.3 + Math.random() * 0.2;
            
            // Reset rotation with slight variation
            cloud.rotation.z = (Math.random() - 0.5) * 0.3; // ± 8.6° from horizontal
            

          }
          
          // Update cloud color and opacity based on weather
          const isStormy = weatherStateRef.current === 'stormy';
          const targetColor = isStormy ? cloud.userData.stormColor : cloud.userData.baseColor;
          const targetOpacity = isStormy ? cloud.userData.stormOpacity : cloud.userData.baseOpacity;
          
          cloud.material.color.r += (targetColor.r - cloud.material.color.r) * 0.08; // Even faster transition
          cloud.material.color.g += (targetColor.g - cloud.material.color.g) * 0.08;
          cloud.material.color.b += (targetColor.b - cloud.material.color.b) * 0.08;
          cloud.material.opacity += (targetOpacity - cloud.material.opacity) * 0.08;
        });
        
        // Animate stars
        if (starsRef.current) {
          // Stars rotate very slowly
          starsRef.current.rotation.y += 0.0001;
          starsRef.current.rotation.x += 0.00005;
        }
        
        // Animate rain
        if (weatherStateRef.current === 'stormy' && rainRef.current) {
          const positions = rainRef.current.geometry.attributes.position.array;
          const velocities = rainRef.current.geometry.attributes.velocity.array;
          
          for (let i = 0; i < rainCount; i++) {
            // Increase velocity (gravity)
            velocities[i] -= 0.1 + Math.random() * 0.1;
            
            // Update position
            positions[i * 3 + 1] += velocities[i];
            
            // Reset raindrop when it falls below
            if (positions[i * 3 + 1] < -200) {
              positions[i * 3 + 1] = 200;
              velocities[i] = 0;
              positions[i * 3] = Math.random() * 600 - 300;
              positions[i * 3 + 2] = Math.random() * 400 - 200;
            }
          }
          
          rainRef.current.geometry.attributes.position.needsUpdate = true;
          rainRef.current.rotation.y += 0.002;
        }
        
        // Animate lightning during storm
        if (weatherStateRef.current === 'stormy' && flashRef.current) {
          // Random chance for lightning strike
          if (Math.random() > 0.96 || flashRef.current.power > 100) {
            if (flashRef.current.power < 100) {
              // Position main flash randomly
              flashRef.current.position.set(
                Math.random() * 600 - 300,
                200 + Math.random() * 300,
                Math.random() * 200 - 100
              );
              // Position secondary flash
              if (flashRef.current.secondary) {
                flashRef.current.secondary.position.set(
                  Math.random() * 600 - 300,
                  200 + Math.random() * 300,
                  Math.random() * 200 - 100
                );
              }
            }
            // Strong flash with random intensity
            flashRef.current.power = 200 + Math.random() * 800;
            if (flashRef.current.secondary) {
              flashRef.current.secondary.power = 100 + Math.random() * 400;
            }
            
            // Brief screen flash effect
            renderer.setClearColor(0xFFFFFF, 0.1);
            setTimeout(() => {
              renderer.setClearColor(scene.fog.color, 1);
            }, 50);
          }
          // Rapid fade out for realistic lightning
          flashRef.current.power *= 0.9;
          if (flashRef.current.secondary) {
            flashRef.current.secondary.power *= 0.85;
          }
        } else if (flashRef.current) {
          flashRef.current.power = 0;
          if (flashRef.current.secondary) {
            flashRef.current.secondary.power = 0;
          }
        }

        renderer.render(scene, camera);
      };
      
      // Start animation immediately (even before textures load)
      if (!animationStartedRef.current) {
        animationStartedRef.current = true;
        console.log('Starting animation immediately...');
        console.log('Renderer:', renderer);
        console.log('Scene:', scene);
        console.log('Camera:', camera);
        animate();
      } else {
        console.log('Animation already started, skipping...');
      }

      // Load cloud textures
      const loader = new THREE.TextureLoader();
      console.log('Loading cloud textures...');
      
      // Function to create clouds with loaded texture
      const createClouds = (textureType: 'clear' | 'stormy') => {
        console.log(`Creating clouds with ${textureType} texture`);
        
        // Only create clouds if this is the current weather texture
        if ((textureType === 'clear' && weatherState === 'clear') || 
            (textureType === 'stormy' && weatherState === 'stormy')) {
          
          // Remove existing clouds
          cloudParticlesRef.current.forEach(cloud => {
            scene.remove(cloud);
            cloud.geometry.dispose();
            cloud.material.dispose();
          });
          cloudParticlesRef.current = [];
          
          // Create wider cloud geometry
          const cloudGeo = new THREE.PlaneGeometry(600, 400);
          
          // Create cloud particles
          const cloudParticles: any[] = [];
          const cloudCount = 7;
          
          for (let p = 0; p < cloudCount; p++) {
            const texture = textureType === 'clear' ? texturesRef.current.clear : texturesRef.current.stormy;
            
            const cloudMaterial = new THREE.MeshBasicMaterial({
              map: texture,
              transparent: true,
              depthWrite: false,
              side: THREE.DoubleSide
            });
            
            const cloud = new THREE.Mesh(cloudGeo, cloudMaterial);
            
            // Position clouds with natural distribution
            const angle = (p / cloudCount) * Math.PI * 2 + Math.random() * 0.5;
            const radius = 300 + Math.random() * 200;
            const xPos = Math.sin(angle) * radius;
            const yPos = -50 - Math.random() * 150;
            const zPos = -200 - Math.random() * 300;
            cloud.position.set(xPos, yPos, zPos);
            
            // Face the camera
            cloud.rotation.x = 0;
            cloud.rotation.y = 0;
            cloud.rotation.z = (Math.random() - 0.5) * 0.3;
            
            // Vary scale for natural look
            const scale = 0.8 + Math.random() * 0.4;
            cloud.scale.set(scale * 1.5, scale, 1);
            
            // Lower opacity for more natural clouds
            const opacity = 0.3 + Math.random() * 0.2;
            cloud.material.opacity = opacity;
            cloud.material.needsUpdate = true;
            
            // Set initial cloud color to white
            cloud.material.color.setRGB(1, 1, 1);
            
            // Store animation data
            const speed = 0.5 + Math.random() * 0.5;
            cloud.userData = {
              speed: speed,
              floatSpeed: Math.random() * 0.0002,
              floatOffset: Math.random() * Math.PI * 2,
              baseColor: { r: 1, g: 1, b: 1 },
              stormColor: { r: 0.3, g: 0.3, b: 0.35 },  // Brighter storm clouds
              baseOpacity: cloud.material.opacity,
              stormOpacity: Math.min(cloud.material.opacity + 0.5, 0.95)  // More opaque storm clouds
            };
            
            cloudParticles.push(cloud);
            scene.add(cloud);
          }
          
          cloudParticlesRef.current = cloudParticles;
          console.log('Clouds created successfully:', cloudParticles.length, 'clouds');
        }
      };
      
      // Load only the currently needed texture first
      const primaryTexture = weatherState === 'clear' ? '/img-cloud1.png' : '/smoke-1.png';
      const secondaryTexture = weatherState === 'clear' ? '/smoke-1.png' : '/img-cloud1.png';
      
      // Load primary texture first
      loader.load(primaryTexture, 
        (texture: any) => {
          console.log(`Primary ${weatherState} texture loaded`);
          if (weatherState === 'clear') {
            texturesRef.current.clear = texture;
            createClouds('clear');
          } else {
            texturesRef.current.stormy = texture;
            createClouds('stormy');
          }
        },
        undefined,
        (error: any) => {
          console.error(`Error loading primary ${weatherState} texture:`, error);
        }
      );
      
      // Load secondary texture in background
      loader.load(secondaryTexture, 
        (texture: any) => {
          console.log(`Secondary texture loaded`);
          if (weatherState === 'clear') {
            texturesRef.current.stormy = texture;
          } else {
            texturesRef.current.clear = texture;
          }
        },
        undefined,
        (error: any) => {
          console.error('Error loading secondary texture:', error);
        }
      );

      // Update weather state when prop changes
      weatherStateRef.current = weatherState;
      
      // Initial weather setup
      console.log('Initial weather setup:', weatherState);
      console.log('Stars ref:', starsRef.current);
      console.log('Rain ref:', rainRef.current);
      
      if (weatherState === 'stormy') {
        ambient.intensity = 0.4;
        directionalLight.intensity = 0.6;
        // Show rain
        if (rainRef.current) {
          rainRef.current.material.opacity = 0.6;
          console.log('Initial rain opacity set to 0.6');
        }
        // Show stars
        if (starsRef.current) {
          starsRef.current.material.opacity = 0.8;
          console.log('Initial stars opacity set to 0.8');
        }
      } else {
        ambient.intensity = 0.8;
        directionalLight.intensity = 1;
        // Hide rain
        if (rainRef.current) {
          rainRef.current.material.opacity = 0;
        }
        // Hide stars
        if (starsRef.current) {
          starsRef.current.material.opacity = 0;
        }
      }
      
        // Mount renderer
        if (mountRef.current && renderer.domElement) {
          mountRef.current.appendChild(renderer.domElement);
          console.log('Renderer mounted to DOM');
        } else {
          console.error('Failed to mount renderer to DOM');
        }

      // Handle resize
      const handleResize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        
        renderer.setSize(width, height);
      };
      window.addEventListener('resize', handleResize);

      // Cleanup
      return () => {
        console.log('Cleaning up CloudBackground...');
        window.removeEventListener('resize', handleResize);
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
          animationIdRef.current = undefined;
        }
        animationStartedRef.current = false;
        if (mountRef.current && renderer.domElement) {
          mountRef.current.removeChild(renderer.domElement);
        }
        renderer.dispose();
        scene.clear();
      };
      } catch (error) {
        console.error('Error initializing CloudBackground:', error);
        animationStartedRef.current = false;
      }
    };

    initScene();
    
    return () => {
      mounted = false;
    };
  }, []);
  
  // Update weather state when prop changes
  useEffect(() => {
    console.log('Weather state changed to:', weatherState);
    weatherStateRef.current = weatherState;
    
    // Update cloud textures
    if (texturesRef.current.clear && texturesRef.current.stormy && cloudParticlesRef.current.length > 0) {
      const newTexture = weatherState === 'clear' ? texturesRef.current.clear : texturesRef.current.stormy;
      
      cloudParticlesRef.current.forEach((cloud) => {
        cloud.material.map = newTexture;
        cloud.material.needsUpdate = true;
      });
      
      console.log(`Updated cloud textures to ${weatherState} weather`);
    }
    
    // Update sky background
    if (sceneRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 128;
      const context = canvas.getContext('2d');
      
      if (context) {
        const gradient = context.createLinearGradient(0, 0, 0, 128);
        
        if (weatherState === 'stormy') {
          // Midnight sky gradient for stormy weather
          gradient.addColorStop(0, '#000000');
          gradient.addColorStop(0.3, '#020617');
          gradient.addColorStop(0.6, '#0a0f1f');
          gradient.addColorStop(0.8, '#0f1729');
          gradient.addColorStop(1, '#1a2341');
        } else {
          // Clear blue sky
          gradient.addColorStop(0, '#4A90E2');
          gradient.addColorStop(0.5, '#87CEEB');
          gradient.addColorStop(0.8, '#B0E0E6');
          gradient.addColorStop(1, '#E0F6FF');
        }
        
        context.fillStyle = gradient;
        context.fillRect(0, 0, 1, 128);
      }
      
      import('three').then((THREE) => {
        const skyTexture = new THREE.CanvasTexture(canvas);
        skyTexture.mapping = THREE.EquirectangularReflectionMapping;
        sceneRef.current.background = skyTexture;
        sceneRef.current.fog = new THREE.FogExp2(weatherState === 'stormy' ? 0x0a0f1f : 0xB0E0E6, 0.0005);
      });
    }
    
    // Update lighting based on weather
    if (sceneRef.current) {
      const lights = sceneRef.current.children.filter((child: any) => child.isLight);
      const ambient = lights.find((light: any) => light.isAmbientLight);
      const directionalLight = lights.find((light: any) => light.isDirectionalLight);
      
      if (weatherState === 'stormy') {
        if (ambient) ambient.intensity = 0.4;
        if (directionalLight) directionalLight.intensity = 0.6;
        // Show rain
        if (rainRef.current) {
          rainRef.current.material.opacity = 0.6;
        }
        // Show stars
        if (starsRef.current) {
          starsRef.current.material.opacity = 0.8;
        }
      } else {
        if (ambient) ambient.intensity = 0.8;
        if (directionalLight) directionalLight.intensity = 1;
        // Hide rain
        if (rainRef.current) {
          rainRef.current.material.opacity = 0;
        }
        // Hide stars
        if (starsRef.current) {
          starsRef.current.material.opacity = 0;
        }
      }
    }
  }, [weatherState]);

  return (
    <div 
      ref={mountRef} 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none'
      }}
    />
  );
};

export default CloudBackground; 