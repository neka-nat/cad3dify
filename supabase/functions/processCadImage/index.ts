import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ProcessRequest {
  imageData: string
  fileName: string
  prompt: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { imageData, fileName, prompt }: ProcessRequest = await req.json()

    console.log('Processing CAD image:', fileName)

    // Decode base64 image data
    const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0))
    
    // Upload image to Supabase Storage
    const imageFileName = `input_${Date.now()}_${fileName}`
    const { data: imageUpload, error: imageError } = await supabaseClient.storage
      .from('cad-images')
      .upload(imageFileName, imageBytes, {
        contentType: fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
        upsert: false
      })

    if (imageError) {
      console.error('Image upload error:', imageError)
      throw new Error(`Image upload failed: ${imageError.message}`)
    }

    console.log('Image uploaded successfully:', imageFileName)

    // Get the public URL for the uploaded image
    const { data: imageUrl } = supabaseClient.storage
      .from('cad-images')
      .getPublicUrl(imageFileName)

    // Create temporary files for processing
    const tempImagePath = `/tmp/input_${Date.now()}.jpg`
    const tempStepPath = `/tmp/output_${Date.now()}.step`
    
    await Deno.writeFile(tempImagePath, imageBytes)
    console.log('Temporary image file created:', tempImagePath)

    // Check if Python and required packages are available
    try {
      const pythonCheck = new Deno.Command('python3', {
        args: ['-c', 'import sys; print(sys.version)'],
        stdout: 'piped',
        stderr: 'piped',
      })
      const { code: checkCode } = await pythonCheck.output()
      if (checkCode !== 0) {
        throw new Error('Python3 not available')
      }
    } catch (error) {
      console.error('Python check failed:', error)
      throw new Error('Python environment not properly configured')
    }

    // Set up environment for Python execution
    const env = {
      ...Deno.env.toObject(),
      PYTHONPATH: '/home/project',
      PATH: `${Deno.env.get('PATH')}:/usr/local/bin:/usr/bin:/bin`,
      OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY') || '',
    }

    console.log('Starting Python CAD processing...')

    // Execute the CAD3Dify Python script with timeout
    const pythonProcess = new Deno.Command('python3', {
      args: ['/home/project/scripts/cli.py', tempImagePath, '--output_filepath', tempStepPath],
      cwd: '/home/project',
      stdout: 'piped',
      stderr: 'piped',
      env: env,
    })

    // Set a timeout for the Python process (5 minutes)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Processing timeout - operation took too long')), 300000)
    })

    const processPromise = pythonProcess.output()
    
    const { code, stdout, stderr } = await Promise.race([processPromise, timeoutPromise]) as any
    
    const stdoutText = new TextDecoder().decode(stdout)
    const stderrText = new TextDecoder().decode(stderr)
    
    console.log('Python stdout:', stdoutText)
    if (stderrText) console.log('Python stderr:', stderrText)
    
    if (code !== 0) {
      throw new Error(`Python script failed (exit code ${code}): ${stderrText || 'Unknown error'}`)
    }

    console.log('Python processing completed successfully')

    // Check if STEP file was created
    let stepFileData: Uint8Array
    try {
      stepFileData = await Deno.readFile(tempStepPath)
      console.log('STEP file read successfully, size:', stepFileData.length, 'bytes')
    } catch (error) {
      console.error('STEP file read error:', error)
      throw new Error(`STEP file not generated: ${error.message}`)
    }
    
    // Upload STEP file to Supabase Storage
    const stepFileName = `output_${Date.now()}.step`
    const { data: stepUpload, error: stepError } = await supabaseClient.storage
      .from('cad-models')
      .upload(stepFileName, stepFileData, {
        contentType: 'application/step',
        upsert: false
      })

    if (stepError) {
      console.error('STEP upload error:', stepError)
      throw new Error(`STEP file upload failed: ${stepError.message}`)
    }

    console.log('STEP file uploaded successfully:', stepFileName)

    // Get the public URL for the STEP file
    const { data: stepUrl } = supabaseClient.storage
      .from('cad-models')
      .getPublicUrl(stepFileName)

    // Insert record into models table
    const { data: modelRecord, error: dbError } = await supabaseClient
      .from('models')
      .insert({
        prompt: prompt || 'Generated from 2D CAD image',
        file_url: stepUrl.publicUrl,
        project_id: null
      })
      .select()
      .single()

    if (dbError) {
      console.warn('Database insert failed:', dbError.message)
      // Don't fail the entire request if DB insert fails
    }

    // Clean up temporary files
    try {
      await Deno.remove(tempImagePath)
      await Deno.remove(tempStepPath)
      console.log('Temporary files cleaned up')
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary files:', cleanupError)
    }

    console.log('Processing completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        modelId: modelRecord?.id || null,
        imageUrl: imageUrl.publicUrl,
        stepUrl: stepUrl.publicUrl,
        message: 'CAD model generated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )

  } catch (error) {
    console.error('Error processing CAD image:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})