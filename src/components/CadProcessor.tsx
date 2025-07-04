import React, { useState, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { supabase } from '../lib/supabase'

interface ProcessingResult {
  success: boolean
  modelId?: string
  imageUrl?: string
  stepUrl?: string
  error?: string
  message?: string
}

export const CadProcessor: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ProcessingResult | null>(null)
  const [dragActive, setDragActive] = useState(false)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef({
    mouseX: 0,
    mouseY: 0,
    isMouseDown: false,
    rotationX: 0,
    rotationY: 0
  })

  useEffect(() => {
    if (!canvasRef.current) return

    // Initialize Three.js scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf8fafc)
    
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
    camera.position.set(5, 5, 5)
    camera.lookAt(0, 0, 0)
    
    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvasRef.current,
      antialias: true 
    })
    renderer.setSize(800, 600)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4)
    scene.add(ambientLight)
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(10, 10, 5)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    scene.add(directionalLight)

    // Add a subtle point light
    const pointLight = new THREE.PointLight(0x4f46e5, 0.3, 100)
    pointLight.position.set(-5, 5, 5)
    scene.add(pointLight)

    // Add grid helper
    const gridHelper = new THREE.GridHelper(10, 10, 0xe2e8f0, 0xf1f5f9)
    scene.add(gridHelper)

    // Mouse controls
    const handleMouseDown = (event: MouseEvent) => {
      controlsRef.current.isMouseDown = true
      controlsRef.current.mouseX = event.clientX
      controlsRef.current.mouseY = event.clientY
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!controlsRef.current.isMouseDown) return
      
      const deltaX = event.clientX - controlsRef.current.mouseX
      const deltaY = event.clientY - controlsRef.current.mouseY
      
      controlsRef.current.rotationY += deltaX * 0.01
      controlsRef.current.rotationX += deltaY * 0.01
      
      // Limit vertical rotation
      controlsRef.current.rotationX = Math.max(-Math.PI/2, Math.min(Math.PI/2, controlsRef.current.rotationX))
      
      // Update camera position
      const radius = 8
      camera.position.x = radius * Math.cos(controlsRef.current.rotationY) * Math.cos(controlsRef.current.rotationX)
      camera.position.y = radius * Math.sin(controlsRef.current.rotationX)
      camera.position.z = radius * Math.sin(controlsRef.current.rotationY) * Math.cos(controlsRef.current.rotationX)
      
      camera.lookAt(0, 0, 0)
      
      controlsRef.current.mouseX = event.clientX
      controlsRef.current.mouseY = event.clientY
    }

    const handleMouseUp = () => {
      controlsRef.current.isMouseDown = false
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const scale = event.deltaY > 0 ? 1.1 : 0.9
      camera.position.multiplyScalar(scale)
      camera.position.clampLength(2, 20)
    }

    canvasRef.current.addEventListener('mousedown', handleMouseDown)
    canvasRef.current.addEventListener('mousemove', handleMouseMove)
    canvasRef.current.addEventListener('mouseup', handleMouseUp)
    canvasRef.current.addEventListener('wheel', handleWheel)

    sceneRef.current = scene
    rendererRef.current = renderer
    cameraRef.current = camera

    // Add initial placeholder
    displayWelcomeModel()

    const animate = () => {
      requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('mousedown', handleMouseDown)
        canvasRef.current.removeEventListener('mousemove', handleMouseMove)
        canvasRef.current.removeEventListener('mouseup', handleMouseUp)
        canvasRef.current.removeEventListener('wheel', handleWheel)
      }
    }
  }, [])

  const displayWelcomeModel = () => {
    if (!sceneRef.current) return

    // Clear existing models
    const objectsToRemove = sceneRef.current.children.filter(child => 
      child.type === 'Mesh' && child.name === 'cadModel'
    )
    objectsToRemove.forEach(obj => sceneRef.current!.remove(obj))

    // Create a welcome model - a simple house-like structure
    const group = new THREE.Group()
    group.name = 'cadModel'

    // Base
    const baseGeometry = new THREE.BoxGeometry(3, 0.2, 2)
    const baseMaterial = new THREE.MeshLambertMaterial({ color: 0x64748b })
    const base = new THREE.Mesh(baseGeometry, baseMaterial)
    base.position.y = 0.1
    base.castShadow = true
    base.receiveShadow = true
    group.add(base)

    // Walls
    const wallGeometry = new THREE.BoxGeometry(3, 2, 2)
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x94a3b8 })
    const walls = new THREE.Mesh(wallGeometry, wallMaterial)
    walls.position.y = 1.1
    walls.castShadow = true
    walls.receiveShadow = true
    group.add(walls)

    // Roof
    const roofGeometry = new THREE.ConeGeometry(2.2, 1, 4)
    const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x4f46e5 })
    const roof = new THREE.Mesh(roofGeometry, roofMaterial)
    roof.position.y = 2.6
    roof.rotation.y = Math.PI / 4
    roof.castShadow = true
    group.add(roof)

    sceneRef.current.add(group)
  }

  const displaySuccessModel = () => {
    if (!sceneRef.current) return

    // Clear existing models
    const objectsToRemove = sceneRef.current.children.filter(child => 
      child.type === 'Mesh' && child.name === 'cadModel'
    )
    objectsToRemove.forEach(obj => sceneRef.current!.remove(obj))

    // Create a success model - a more complex geometric shape
    const group = new THREE.Group()
    group.name = 'cadModel'

    // Main body
    const bodyGeometry = new THREE.CylinderGeometry(1.5, 1.5, 3, 8)
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x10b981 })
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.position.y = 1.5
    body.castShadow = true
    body.receiveShadow = true
    group.add(body)

    // Top cap
    const capGeometry = new THREE.CylinderGeometry(1.8, 1.8, 0.3, 8)
    const capMaterial = new THREE.MeshLambertMaterial({ color: 0x059669 })
    const cap = new THREE.Mesh(capGeometry, capMaterial)
    cap.position.y = 3.15
    cap.castShadow = true
    group.add(cap)

    // Details
    for (let i = 0; i < 4; i++) {
      const detailGeometry = new THREE.BoxGeometry(0.3, 2.5, 0.3)
      const detailMaterial = new THREE.MeshLambertMaterial({ color: 0x047857 })
      const detail = new THREE.Mesh(detailGeometry, detailMaterial)
      const angle = (i / 4) * Math.PI * 2
      detail.position.x = Math.cos(angle) * 1.2
      detail.position.z = Math.sin(angle) * 1.2
      detail.position.y = 1.5
      detail.castShadow = true
      group.add(detail)
    }

    sceneRef.current.add(group)

    // Add a gentle rotation animation
    const animate = () => {
      group.rotation.y += 0.005
      requestAnimationFrame(animate)
    }
    animate()
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.type.startsWith('image/')) {
        setSelectedFile(file)
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(',')[1]) // Remove data:image/jpeg;base64, prefix
      }
      reader.onerror = error => reject(error)
    })
  }

  const processImage = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    setResult(null)

    try {
      const imageData = await convertFileToBase64(selectedFile)
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/processCadImage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          imageData,
          fileName: selectedFile.name,
          prompt: prompt.trim() || 'Generate 3D model from 2D CAD drawing'
        })
      })

      const result: ProcessingResult = await response.json()
      setResult(result)

      if (result.success && result.stepUrl) {
        displaySuccessModel()
      }

    } catch (error) {
      console.error('Processing error:', error)
      setResult({
        success: false,
        error: 'Failed to process image. Please try again.'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            CAD3Dify
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Transform your 2D CAD drawings into stunning 3D models using advanced AI technology
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">
                Upload & Process
              </h2>
            </div>
            
            {/* File Upload */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50 scale-105' 
                  : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <div className="space-y-4">
                  <div className="relative inline-block">
                    <img
                      src={URL.createObjectURL(selectedFile)}
                      alt="Selected"
                      className="max-w-full max-h-48 mx-auto rounded-lg shadow-md"
                    />
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-700">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium transition-colors"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-gray-400">
                    <svg className="mx-auto h-16 w-16" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-medium text-gray-700">
                      Drag and drop your CAD image here
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Supports PNG, JPG, JPEG files up to 10MB
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Select File
                  </label>
                </div>
              )}
            </div>

            {/* Prompt Input */}
            <div className="mt-8">
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-3">
                Description (optional)
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want to create from this CAD drawing... (e.g., 'Create a mechanical part with precise dimensions')"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                rows={3}
              />
            </div>

            {/* Process Button */}
            <button
              onClick={processImage}
              disabled={!selectedFile || isProcessing}
              className="w-full mt-8 px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
            >
              {isProcessing ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                  <span>Processing your CAD drawing...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate 3D Model
                </div>
              )}
            </button>

            {/* Result */}
            {result && (
              <div className="mt-8">
                {result.success ? (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                    <div className="flex items-center mb-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-green-800 font-semibold text-lg">Success!</h3>
                    </div>
                    <p className="text-green-700 mb-4">
                      {result.message || 'Your 3D model has been generated successfully.'}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <a
                        href={result.stepUrl}
                        download
                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-md hover:shadow-lg"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download STEP File
                      </a>
                      {result.imageUrl && (
                        <a
                          href={result.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          View Original
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-6">
                    <div className="flex items-center mb-3">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <h3 className="text-red-800 font-semibold text-lg">Processing Failed</h3>
                    </div>
                    <p className="text-red-700">
                      {result.error || 'An unexpected error occurred. Please try again.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3D Viewer Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">
                3D Preview
              </h2>
            </div>
            
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-inner bg-gradient-to-br from-gray-50 to-gray-100">
              <canvas
                ref={canvasRef}
                className="w-full h-96 cursor-grab active:cursor-grabbing"
                style={{ maxWidth: '100%', height: '400px' }}
              />
            </div>
            
            <div className="mt-6 bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Controls:</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• <strong>Click and drag</strong> to rotate the view</p>
                <p>• <strong>Scroll</strong> to zoom in/out</p>
                <p>• Upload and process an image to see your 3D model</p>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered</h3>
            <p className="text-gray-600">Advanced AI algorithms analyze your 2D drawings and generate accurate 3D models</p>
          </div>
          
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Fast Processing</h3>
            <p className="text-gray-600">Get your 3D models in minutes, not hours. Our optimized pipeline ensures quick results</p>
          </div>
          
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Industry Standard</h3>
            <p className="text-gray-600">Export to STEP format, compatible with all major CAD software and 3D printers</p>
          </div>
        </div>
      </div>
    </div>
  )
}