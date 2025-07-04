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
      throw new Error(`Image upload failed: ${imageError.message}`)
    }

    // Get the public URL for the uploaded image
    const { data: imageUrl } = supabaseClient.storage
      .from('cad-images')
      .getPublicUrl(imageFileName)

    // Create a temporary file for processing
    const tempImagePath = `/tmp/input_${Date.now()}.jpg`
    const tempStepPath = `/tmp/output_${Date.now()}.step`
    
    await Deno.writeFile(tempImagePath, imageBytes)

    // Set up environment for Python execution
    const env = {
      ...Deno.env.toObject(),
      PYTHONPATH: '/home/project',
      PATH: `${Deno.env.get('PATH')}:/usr/local/bin:/usr/bin:/bin`,
    }

    // Execute the CAD3Dify Python script
    const pythonProcess = new Deno.Command('python3', {
      args: ['/home/project/scripts/cli.py', tempImagePath, '--output_filepath', tempStepPath],
      cwd: '/home/project',
      stdout: 'piped',
      stderr: 'piped',
      env: env,
    })

    const { code, stdout, stderr } = await pythonProcess.output()
    
    const stdoutText = new TextDecoder().decode(stdout)
    const stderrText = new TextDecoder().decode(stderr)
    
    console.log('Python stdout:', stdoutText)
    console.log('Python stderr:', stderrText)
    
    if (code !== 0) {
      throw new Error(`Python script failed (exit code ${code}): ${stderrText}`)
    }

    // Check if STEP file was created
    let stepFileData: Uint8Array
    try {
      stepFileData = await Deno.readFile(tempStepPath)
    } catch (error) {
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
      throw new Error(`STEP file upload failed: ${stepError.message}`)
    }

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
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary files:', cleanupError)
    }

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