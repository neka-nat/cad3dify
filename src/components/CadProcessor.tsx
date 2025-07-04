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

interface ChatMessage {
  id: string
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  imageUrl?: string
  stepUrl?: string
}

export const CadProcessor: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [isViewerReady, setIsViewerReady] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'system',
      content: 'Welcome to CAD3Dify! Upload a 2D CAD drawing and I\'ll convert it to a 3D model.',
      timestamp: new Date()
    }
  ])
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const frameRef = useRef<number>()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef({
    mouseX: 0,
    mouseY: 0,
    isMouseDown: false,
    rotationX: 0,
    rotationY: 0
  })

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!canvasRef.current) return

    try {
      // Initialize Three.js scene
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x1e293b)
      
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
      camera.position.set(5, 5, 5)
      camera.lookAt(0, 0, 0)
      
      const renderer = new THREE.WebGLRenderer({ 
        canvas: canvasRef.current,
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true
      })
      
      // Set size and pixel ratio
      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      const width = rect.width || 800
      const height = rect.height || 600
      
      renderer.setSize(width, height, false)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      renderer.outputColorSpace = THREE.SRGBColorSpace

      // Update camera aspect ratio
      camera.aspect = width / height
      camera.updateProjectionMatrix()

      // Add lights
      const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
      scene.add(ambientLight)
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
      directionalLight.position.set(10, 10, 5)
      directionalLight.castShadow = true
      directionalLight.shadow.mapSize.width = 1024
      directionalLight.shadow.mapSize.height = 1024
      scene.add(directionalLight)

      // Add a subtle point light
      const pointLight = new THREE.PointLight(0x3b82f6, 0.4, 100)
      pointLight.position.set(-5, 5, 5)
      scene.add(pointLight)

      // Add grid helper
      const gridHelper = new THREE.GridHelper(10, 10, 0x475569, 0x334155)
      gridHelper.position.y = -0.01
      scene.add(gridHelper)

      // Mouse controls
      const handleMouseDown = (event: MouseEvent) => {
        event.preventDefault()
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

      // Handle window resize
      const handleResize = () => {
        const rect = canvas.getBoundingClientRect()
        const width = rect.width || 800
        const height = rect.height || 600
        
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        renderer.setSize(width, height, false)
      }

      canvas.addEventListener('mousedown', handleMouseDown)
      canvas.addEventListener('mousemove', handleMouseMove)
      canvas.addEventListener('mouseup', handleMouseUp)
      canvas.addEventListener('mouseleave', handleMouseUp)
      canvas.addEventListener('wheel', handleWheel, { passive: false })
      window.addEventListener('resize', handleResize)

      sceneRef.current = scene
      rendererRef.current = renderer
      cameraRef.current = camera

      // Add initial placeholder
      displayWelcomeModel()

      const animate = () => {
        frameRef.current = requestAnimationFrame(animate)
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current)
        }
      }
      animate()

      setIsViewerReady(true)

      return () => {
        if (frameRef.current) {
          cancelAnimationFrame(frameRef.current)
        }
        canvas.removeEventListener('mousedown', handleMouseDown)
        canvas.removeEventListener('mousemove', handleMouseMove)
        canvas.removeEventListener('mouseup', handleMouseUp)
        canvas.removeEventListener('mouseleave', handleMouseUp)
        canvas.removeEventListener('wheel', handleWheel)
        window.removeEventListener('resize', handleResize)
        if (rendererRef.current) {
          rendererRef.current.dispose()
        }
      }
    } catch (error) {
      console.error('Failed to initialize 3D viewer:', error)
    }
  }, [])

  const displayWelcomeModel = () => {
    if (!sceneRef.current) return

    // Clear existing models
    const objectsToRemove = sceneRef.current.children.filter(child => 
      child.name === 'cadModel'
    )
    objectsToRemove.forEach(obj => sceneRef.current!.remove(obj))

    // Create a welcome model - a simple geometric shape
    const group = new THREE.Group()
    group.name = 'cadModel'

    // Main cube
    const geometry = new THREE.BoxGeometry(2, 2, 2)
    const material = new THREE.MeshLambertMaterial({ color: 0x3b82f6 })
    const cube = new THREE.Mesh(geometry, material)
    cube.position.y = 1
    cube.castShadow = true
    cube.receiveShadow = true
    group.add(cube)

    // Add wireframe
    const wireframe = new THREE.WireframeGeometry(geometry)
    const line = new THREE.LineSegments(wireframe, new THREE.LineBasicMaterial({ color: 0x60a5fa }))
    line.position.copy(cube.position)
    group.add(line)

    sceneRef.current.add(group)
  }

  const displaySuccessModel = () => {
    if (!sceneRef.current) return

    // Clear existing models
    const objectsToRemove = sceneRef.current.children.filter(child => 
      child.name === 'cadModel'
    )
    objectsToRemove.forEach(obj => sceneRef.current!.remove(obj))

    // Create a success model
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

    sceneRef.current.add(group)

    // Add a gentle rotation animation
    let rotationSpeed = 0.005
    const animateSuccess = () => {
      if (group.parent) {
        group.rotation.y += rotationSpeed
        requestAnimationFrame(animateSuccess)
      }
    }
    animateSuccess()
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
        resolve(result.split(',')[1])
      }
      reader.onerror = error => reject(error)
    })
  }

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newMessage])
  }

  const processImage = async () => {
    if (!selectedFile) return

    setIsProcessing(true)

    // Add user message
    addMessage({
      type: 'user',
      content: `Processing: ${selectedFile.name}${prompt ? `\n\nDescription: ${prompt}` : ''}`,
      imageUrl: URL.createObjectURL(selectedFile)
    })

    // Add processing message
    addMessage({
      type: 'assistant',
      content: 'Processing your CAD drawing... This may take a few minutes.'
    })

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

      if (result.success && result.stepUrl) {
        displaySuccessModel()
        addMessage({
          type: 'assistant',
          content: '✅ Success! Your 3D model has been generated successfully. You can download the STEP file below.',
          stepUrl: result.stepUrl
        })
      } else {
        addMessage({
          type: 'assistant',
          content: `❌ Processing failed: ${result.error || 'An unexpected error occurred. Please try again.'}`
        })
      }

    } catch (error) {
      console.error('Processing error:', error)
      addMessage({
        type: 'assistant',
        content: '❌ Failed to process image. Please check your connection and try again.'
      })
    } finally {
      setIsProcessing(false)
      setSelectedFile(null)
      setPrompt('')
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="h-screen bg-slate-900 flex">
      {/* Chat Panel */}
      <div className="w-96 bg-slate-800 border-r border-slate-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-xl font-bold text-white mb-1">CAD3Dify</h1>
          <p className="text-sm text-slate-400">2D to 3D CAD Converter</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs rounded-lg p-3 ${
                message.type === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : message.type === 'system'
                  ? 'bg-slate-700 text-slate-300'
                  : 'bg-slate-700 text-white'
              }`}>
                {message.imageUrl && (
                  <img 
                    src={message.imageUrl} 
                    alt="Uploaded" 
                    className="w-full rounded mb-2 max-h-32 object-cover"
                  />
                )}
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                {message.stepUrl && (
                  <a
                    href={message.stepUrl}
                    download
                    className="inline-flex items-center mt-2 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download STEP
                  </a>
                )}
                <div className="text-xs opacity-70 mt-1">
                  {formatTime(message.timestamp)}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-700">
          {/* File Upload */}
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center mb-3 transition-all ${
              dragActive 
                ? 'border-blue-500 bg-blue-500/10' 
                : 'border-slate-600 hover:border-slate-500'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {selectedFile ? (
              <div className="space-y-2">
                <div className="text-green-400 text-sm">✓ {selectedFile.name}</div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <svg className="mx-auto h-8 w-8 text-slate-400 mb-2" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-slate-400 text-sm">Drop CAD image here</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="text-blue-400 hover:text-blue-300 text-xs cursor-pointer"
                >
                  or click to select
                </label>
              </div>
            )}
          </div>

          {/* Description Input */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your CAD drawing (optional)..."
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm resize-none focus:outline-none focus:border-blue-500"
            rows={2}
          />

          {/* Send Button */}
          <button
            onClick={processImage}
            disabled={!selectedFile || isProcessing}
            className="w-full mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {isProcessing ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </div>
            ) : (
              'Generate 3D Model'
            )}
          </button>
        </div>
      </div>

      {/* 3D Viewer */}
      <div className="flex-1 bg-slate-900 flex flex-col">
        {/* Viewer Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-6 h-6 bg-blue-600 rounded mr-3 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">3D Viewer</h2>
          </div>
          {!isViewerReady && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          )}
        </div>
        
        {/* Viewer Canvas */}
        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-grab active:cursor-grabbing block"
          />
          {!isViewerReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-slate-400">Loading 3D viewer...</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Viewer Controls Info */}
        <div className="p-4 border-t border-slate-700 bg-slate-800">
          <div className="text-sm text-slate-400 space-y-1">
            <p><strong className="text-slate-300">Controls:</strong> Click & drag to rotate • Scroll to zoom</p>
            <p>Upload a CAD drawing to see your generated 3D model here</p>
          </div>
        </div>
      </div>
    </div>
  )
}