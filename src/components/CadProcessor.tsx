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
  const [isChatCollapsed, setIsChatCollapsed] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'system',
      content: 'Welcome to CAD3Dify! Upload a 2D CAD drawing and I\'ll convert it to a 3D model using advanced AI.',
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
      // Initialize Three.js scene with enhanced visuals
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x0f172a) // Darker background
      scene.fog = new THREE.Fog(0x0f172a, 10, 50) // Add atmospheric fog
      
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
      camera.position.set(6, 6, 6)
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
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.2

      // Update camera aspect ratio
      camera.aspect = width / height
      camera.updateProjectionMatrix()

      // Enhanced lighting setup
      const ambientLight = new THREE.AmbientLight(0x404040, 0.4)
      scene.add(ambientLight)
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2)
      directionalLight.position.set(12, 12, 8)
      directionalLight.castShadow = true
      directionalLight.shadow.mapSize.width = 2048
      directionalLight.shadow.mapSize.height = 2048
      directionalLight.shadow.camera.near = 0.5
      directionalLight.shadow.camera.far = 50
      directionalLight.shadow.camera.left = -10
      directionalLight.shadow.camera.right = 10
      directionalLight.shadow.camera.top = 10
      directionalLight.shadow.camera.bottom = -10
      scene.add(directionalLight)

      // Add rim lighting
      const rimLight = new THREE.DirectionalLight(0x6366f1, 0.6)
      rimLight.position.set(-8, 4, -8)
      scene.add(rimLight)

      // Add fill light
      const fillLight = new THREE.PointLight(0x8b5cf6, 0.3, 100)
      fillLight.position.set(-6, 6, 6)
      scene.add(fillLight)

      // Enhanced grid with better materials
      const gridHelper = new THREE.GridHelper(12, 24, 0x475569, 0x1e293b)
      gridHelper.position.y = -0.01
      gridHelper.material.opacity = 0.6
      gridHelper.material.transparent = true
      scene.add(gridHelper)

      // Add coordinate axes
      const axesHelper = new THREE.AxesHelper(2)
      axesHelper.position.set(-5, 0, -5)
      scene.add(axesHelper)

      // Mouse controls with smooth interpolation
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
        
        controlsRef.current.rotationY += deltaX * 0.008
        controlsRef.current.rotationX += deltaY * 0.008
        
        // Limit vertical rotation
        controlsRef.current.rotationX = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, controlsRef.current.rotationX))
        
        // Update camera position with smooth movement
        const radius = 10
        const targetX = radius * Math.cos(controlsRef.current.rotationY) * Math.cos(controlsRef.current.rotationX)
        const targetY = radius * Math.sin(controlsRef.current.rotationX)
        const targetZ = radius * Math.sin(controlsRef.current.rotationY) * Math.cos(controlsRef.current.rotationX)
        
        camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.1)
        camera.lookAt(0, 0, 0)
        
        controlsRef.current.mouseX = event.clientX
        controlsRef.current.mouseY = event.clientY
      }

      const handleMouseUp = () => {
        controlsRef.current.isMouseDown = false
      }

      const handleWheel = (event: WheelEvent) => {
        event.preventDefault()
        const scale = event.deltaY > 0 ? 1.05 : 0.95
        const newPosition = camera.position.clone().multiplyScalar(scale)
        const distance = newPosition.length()
        
        if (distance >= 3 && distance <= 25) {
          camera.position.copy(newPosition)
        }
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

    // Create a more sophisticated welcome model
    const group = new THREE.Group()
    group.name = 'cadModel'

    // Main structure - a modern architectural form
    const mainGeometry = new THREE.BoxGeometry(3, 1.5, 3)
    const mainMaterial = new THREE.MeshPhysicalMaterial({ 
      color: 0x6366f1,
      metalness: 0.1,
      roughness: 0.2,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1
    })
    const mainCube = new THREE.Mesh(mainGeometry, mainMaterial)
    mainCube.position.y = 0.75
    mainCube.castShadow = true
    mainCube.receiveShadow = true
    group.add(mainCube)

    // Add detail elements
    const detailGeometry = new THREE.CylinderGeometry(0.3, 0.3, 2, 8)
    const detailMaterial = new THREE.MeshPhysicalMaterial({ 
      color: 0x8b5cf6,
      metalness: 0.3,
      roughness: 0.1
    })
    
    for (let i = 0; i < 4; i++) {
      const detail = new THREE.Mesh(detailGeometry, detailMaterial)
      const angle = (i / 4) * Math.PI * 2
      detail.position.x = Math.cos(angle) * 1.2
      detail.position.z = Math.sin(angle) * 1.2
      detail.position.y = 1
      detail.castShadow = true
      group.add(detail)
    }

    // Add wireframe overlay
    const wireframe = new THREE.WireframeGeometry(mainGeometry)
    const line = new THREE.LineSegments(wireframe, new THREE.LineBasicMaterial({ 
      color: 0xa855f7,
      opacity: 0.3,
      transparent: true
    }))
    line.position.copy(mainCube.position)
    group.add(line)

    sceneRef.current.add(group)

    // Add gentle floating animation
    let time = 0
    const animateWelcome = () => {
      if (group.parent) {
        time += 0.01
        group.position.y = Math.sin(time) * 0.1
        group.rotation.y += 0.002
        requestAnimationFrame(animateWelcome)
      }
    }
    animateWelcome()
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

    // Main body with better materials
    const bodyGeometry = new THREE.CylinderGeometry(1.8, 1.8, 4, 12)
    const bodyMaterial = new THREE.MeshPhysicalMaterial({ 
      color: 0x16a34a,
      metalness: 0.2,
      roughness: 0.1,
      clearcoat: 0.9,
      clearcoatRoughness: 0.05
    })
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.position.y = 2
    body.castShadow = true
    body.receiveShadow = true
    group.add(body)

    // Add success indicator
    const capGeometry = new THREE.ConeGeometry(1, 1.5, 8)
    const capMaterial = new THREE.MeshPhysicalMaterial({ 
      color: 0x22c55e,
      metalness: 0.1,
      roughness: 0.2
    })
    const cap = new THREE.Mesh(capGeometry, capMaterial)
    cap.position.y = 4.75
    cap.castShadow = true
    group.add(cap)

    sceneRef.current.add(group)

    // Add celebration animation
    let rotationSpeed = 0.008
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
      content: '🔄 Processing your CAD drawing... This may take a few minutes while our AI analyzes and generates your 3D model.'
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
          content: '🎉 Success! Your 3D model has been generated successfully. The AI has analyzed your 2D drawing and created a detailed 3D CAD model. You can download the STEP file below.',
          stepUrl: result.stepUrl
        })
      } else {
        addMessage({
          type: 'assistant',
          content: `❌ Processing failed: ${result.error || 'An unexpected error occurred. Please try again with a different image or check your connection.'}`
        })
      }

    } catch (error) {
      console.error('Processing error:', error)
      addMessage({
        type: 'assistant',
        content: '❌ Failed to process image. Please check your connection and try again. Make sure your image is a clear CAD drawing.'
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
    <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, #6366f1 0%, transparent 50%), 
                           radial-gradient(circle at 75% 75%, #8b5cf6 0%, transparent 50%)`
        }}></div>
      </div>

      {/* Chat Panel */}
      <div className={`${isChatCollapsed ? 'w-16' : 'w-full md:w-96 lg:w-[28rem]'} bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50 flex flex-col transition-all duration-300 ease-in-out shadow-2xl relative z-10`}>
        {/* Header */}
        <div className="p-6 border-b border-slate-700/50 bg-gradient-to-r from-indigo-600/10 to-purple-600/10">
          <div className="flex items-center justify-between">
            <div className={`${isChatCollapsed ? 'hidden' : 'block'}`}>
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg mr-3 flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">CAD3Dify</h1>
                  <p className="text-sm text-slate-400">AI-Powered 2D to 3D Converter</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsChatCollapsed(!isChatCollapsed)}
              className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white transition-all duration-200"
            >
              <svg className={`w-5 h-5 transition-transform duration-200 ${isChatCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>

        {!isChatCollapsed && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-sm rounded-2xl p-4 shadow-lg backdrop-blur-sm ${
                    message.type === 'user' 
                      ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white' 
                      : message.type === 'system'
                      ? 'bg-gradient-to-br from-slate-700/80 to-slate-800/80 text-slate-200 border border-slate-600/30'
                      : 'bg-gradient-to-br from-slate-700/80 to-slate-800/80 text-white border border-slate-600/30'
                  }`}>
                    {message.imageUrl && (
                      <div className="mb-3 rounded-xl overflow-hidden shadow-md">
                        <img 
                          src={message.imageUrl} 
                          alt="Uploaded" 
                          className="w-full max-h-40 object-cover"
                        />
                      </div>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    {message.stepUrl && (
                      <a
                        href={message.stepUrl}
                        download
                        className="inline-flex items-center mt-3 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download STEP File
                      </a>
                    )}
                    <div className="text-xs opacity-60 mt-2 font-medium">
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 border-t border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
              {/* File Upload */}
              <div
                className={`border-2 border-dashed rounded-2xl p-6 text-center mb-4 transition-all duration-300 backdrop-blur-sm ${
                  dragActive 
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20' 
                    : 'border-slate-600/50 hover:border-slate-500/70 bg-slate-800/30'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {selectedFile ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <div className="text-green-400 text-sm font-medium">{selectedFile.name}</div>
                    <div className="text-xs text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
                    >
                      Remove File
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-2xl flex items-center justify-center">
                      <svg className="w-8 h-8 text-indigo-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-slate-300 text-sm font-medium mb-1">Drop your CAD image here</p>
                      <p className="text-slate-500 text-xs">Supports JPG, PNG, and other image formats</p>
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
                      className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Choose File
                    </label>
                  </div>
                )}
              </div>

              {/* Description Input */}
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your CAD drawing or add specific requirements (optional)..."
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white text-sm resize-none focus:outline-none focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200 backdrop-blur-sm placeholder-slate-400"
                rows={3}
              />

              {/* Send Button */}
              <button
                onClick={processImage}
                disabled={!selectedFile || isProcessing}
                className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none disabled:shadow-none"
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                    <span>Generating 3D Model...</span>
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
            </div>
          </>
        )}
      </div>

      {/* 3D Viewer */}
      <div className="flex-1 bg-slate-950 flex flex-col relative">
        {/* Viewer Header */}
        <div className="p-6 border-b border-slate-700/50 flex items-center justify-between bg-slate-900/50 backdrop-blur-xl">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl mr-4 flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">3D Viewer</h2>
              <p className="text-sm text-slate-400">Interactive 3D Model Preview</p>
            </div>
          </div>
          {!isViewerReady && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent"></div>
              <span className="text-slate-400 text-sm">Loading...</span>
            </div>
          )}
        </div>
        
        {/* Viewer Canvas */}
        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-grab active:cursor-grabbing block"
          />
          {!isViewerReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-2xl flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
                </div>
                <div>
                  <p className="text-white font-medium">Initializing 3D Viewer</p>
                  <p className="text-slate-400 text-sm">Setting up the rendering environment...</p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Viewer Controls Info */}
        <div className="p-6 border-t border-slate-700/50 bg-slate-900/50 backdrop-blur-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-slate-800/50 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.121 2.122" />
                </svg>
              </div>
              <div>
                <p className="text-slate-300 font-medium">Rotate</p>
                <p className="text-slate-500">Click & drag</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-slate-800/50 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <p className="text-slate-300 font-medium">Zoom</p>
                <p className="text-slate-500">Mouse wheel</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-slate-800/50 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 12l2 2 4-4" />
                </svg>
              </div>
              <div>
                <p className="text-slate-300 font-medium">Upload</p>
                <p className="text-slate-500">CAD drawing</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}