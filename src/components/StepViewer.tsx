import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'

interface StepViewerProps {
  stepUrl?: string
  className?: string
}

export const StepViewer: React.FC<StepViewerProps> = ({ stepUrl, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const frameRef = useRef<number>()

  useEffect(() => {
    if (!canvasRef.current) return

    // Initialize Three.js scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f172a)
    
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
    camera.position.set(5, 5, 5)
    camera.lookAt(0, 0, 0)
    
    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvasRef.current,
      antialias: true
    })
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const width = rect.width || 400
    const height = rect.height || 300
    
    renderer.setSize(width, height, false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    
    camera.aspect = width / height
    camera.updateProjectionMatrix()

    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
    scene.add(ambientLight)
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
    directionalLight.position.set(10, 10, 5)
    scene.add(directionalLight)

    sceneRef.current = scene
    rendererRef.current = renderer
    cameraRef.current = camera

    // Load STEP file if provided
    if (stepUrl) {
      loadStepFile(stepUrl)
    } else {
      // Add placeholder geometry
      const geometry = new THREE.BoxGeometry(2, 2, 2)
      const material = new THREE.MeshLambertMaterial({ color: 0x6366f1 })
      const cube = new THREE.Mesh(geometry, material)
      scene.add(cube)
    }

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current)
      }
    }
    animate()

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
      if (rendererRef.current) {
        rendererRef.current.dispose()
      }
    }
  }, [])

  const loadStepFile = async (url: string) => {
    try {
      // For now, we'll create a representative 3D model
      // In a full implementation, you'd use a STEP file loader
      if (!sceneRef.current) return

      // Clear existing objects
      const objectsToRemove = sceneRef.current.children.filter(child => 
        child instanceof THREE.Mesh
      )
      objectsToRemove.forEach(obj => sceneRef.current!.remove(obj))

      // Create a more complex model to represent the STEP file
      const group = new THREE.Group()

      // Main body
      const bodyGeometry = new THREE.CylinderGeometry(1.5, 1.5, 3, 16)
      const bodyMaterial = new THREE.MeshPhysicalMaterial({ 
        color: 0x10b981,
        metalness: 0.2,
        roughness: 0.1
      })
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
      body.position.y = 1.5
      group.add(body)

      // Add details
      const detailGeometry = new THREE.BoxGeometry(0.5, 0.5, 2)
      const detailMaterial = new THREE.MeshPhysicalMaterial({ 
        color: 0x3b82f6,
        metalness: 0.3,
        roughness: 0.2
      })
      
      for (let i = 0; i < 4; i++) {
        const detail = new THREE.Mesh(detailGeometry, detailMaterial)
        const angle = (i / 4) * Math.PI * 2
        detail.position.x = Math.cos(angle) * 1.8
        detail.position.z = Math.sin(angle) * 1.8
        detail.position.y = 1.5
        detail.rotation.y = angle
        group.add(detail)
      }

      sceneRef.current.add(group)

      // Add rotation animation
      let rotationSpeed = 0.005
      const animateModel = () => {
        if (group.parent) {
          group.rotation.y += rotationSpeed
          requestAnimationFrame(animateModel)
        }
      }
      animateModel()

    } catch (error) {
      console.error('Failed to load STEP file:', error)
    }
  }

  useEffect(() => {
    if (stepUrl) {
      loadStepFile(stepUrl)
    }
  }, [stepUrl])

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
    />
  )
}