/*
  # Storage Setup for CAD3Dify

  1. Storage Buckets
    - `cad-images` - For uploaded 2D CAD images
    - `cad-models` - For generated 3D STEP files
  
  2. Security
    - Public read access for both buckets
    - Authenticated users can upload files
    - Service role has full access
*/

-- Create storage buckets using the storage schema functions
SELECT storage.create_bucket('cad-images', true);
SELECT storage.create_bucket('cad-models', true);

-- Create policies for cad-images bucket
CREATE POLICY "Public read access for cad-images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'cad-images');

CREATE POLICY "Authenticated users can upload cad-images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'cad-images');

CREATE POLICY "Authenticated users can update cad-images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'cad-images');

CREATE POLICY "Authenticated users can delete cad-images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'cad-images');

-- Create policies for cad-models bucket
CREATE POLICY "Public read access for cad-models"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'cad-models');

CREATE POLICY "Authenticated users can upload cad-models"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'cad-models');

CREATE POLICY "Authenticated users can update cad-models"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'cad-models');

CREATE POLICY "Authenticated users can delete cad-models"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'cad-models');

-- Service role policies for full access
CREATE POLICY "Service role can manage cad-images"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'cad-images')
  WITH CHECK (bucket_id = 'cad-images');

CREATE POLICY "Service role can manage cad-models"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'cad-models')
  WITH CHECK (bucket_id = 'cad-models');