import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isSupabaseEnabled = supabaseUrl && supabaseAnonKey && supabaseUrl !== 'your-supabase-project-url';

let supabase = null;
if (isSupabaseEnabled) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

// Local JSON File Database path
const LOCAL_DB_PATH = path.join(process.cwd(), 'db.json');

// Initialize Local Database File
function initLocalDb() {
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify({ candidates: [] }, null, 2));
  }
}

export async function getCandidates() {
  if (isSupabaseEnabled) {
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Supabase getCandidates error, falling back to local database:', err.message);
    }
  }

  // Fallback to Local JSON DB
  initLocalDb();
  try {
    const rawData = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
    const json = JSON.parse(rawData);
    return json.candidates || [];
  } catch (err) {
    console.error('Local database read error:', err);
    return [];
  }
}

export async function addCandidate(candidate) {
  if (isSupabaseEnabled) {
    try {
      const { data, error } = await supabase
        .from('candidates')
        .insert([candidate])
        .select();

      if (error) throw error;
      return data[0];
    } catch (err) {
      console.error('Supabase addCandidate error, falling back to local database:', err.message);
    }
  }

  // Fallback to Local JSON DB
  initLocalDb();
  try {
    const rawData = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
    const json = JSON.parse(rawData);
    
    const newCandidate = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      ...candidate,
      created_at: new Date().toISOString()
    };
    
    json.candidates.push(newCandidate);
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(json, null, 2));
    return newCandidate;
  } catch (err) {
    console.error('Local database write error:', err);
    throw err;
  }
}
export async function deleteCandidate(id) {
  if (isSupabaseEnabled) {
    try {
      const { error } = await supabase
        .from('candidates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Supabase deleteCandidate error, falling back to local database:', err.message);
    }
  }

  // Fallback to Local JSON DB
  initLocalDb();
  try {
    const rawData = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
    const json = JSON.parse(rawData);
    
    const initialLength = json.candidates.length;
    json.candidates = json.candidates.filter(c => c.id !== id);
    
    if (json.candidates.length !== initialLength) {
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(json, null, 2));
      return true;
    }
    return false;
  } catch (err) {
    console.error('Local database delete error:', err);
    throw err;
  }
}

export async function clearAllCandidates() {
  if (isSupabaseEnabled) {
    try {
      const { error } = await supabase
        .from('candidates')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Supabase clearAllCandidates error, falling back to local database:', err.message);
    }
  }

  // Fallback to Local JSON DB
  initLocalDb();
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify({ candidates: [] }, null, 2));
    return true;
  } catch (err) {
    console.error('Local database clear error:', err);
    throw err;
  }
}

export async function saveResumeFile(fileName, fileBuffer) {
  const s3AccessKey = process.env.AWS_ACCESS_KEY_ID;
  const s3SecretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const s3Region = process.env.AWS_REGION || 'us-east-1';
  const s3BucketName = process.env.AWS_S3_BUCKET_NAME;

  const isS3Enabled = s3AccessKey && s3SecretKey && s3BucketName;

  if (isS3Enabled) {
    try {
      console.log(`Uploading ${fileName} to AWS S3 bucket: ${s3BucketName}`);
      const s3Client = new S3Client({
        region: s3Region,
        credentials: {
          accessKeyId: s3AccessKey,
          secretAccessKey: s3SecretKey
        }
      });
      
      const cleanFileName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      await s3Client.send(new PutObjectCommand({
        Bucket: s3BucketName,
        Key: cleanFileName,
        Body: fileBuffer,
        ContentType: fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'
      }));
      
      return `https://${s3BucketName}.s3.${s3Region}.amazonaws.com/${cleanFileName}`;
    } catch (err) {
      console.error('AWS S3 upload error, falling back to Supabase storage:', err.message);
    }
  }

  if (isSupabaseEnabled) {
    try {
      // Clean up filename
      const cleanFileName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      const { data, error } = await supabase.storage
        .from('resumes')
        .upload(cleanFileName, fileBuffer, {
          contentType: 'application/octet-stream',
          upsert: true
        });

      if (error) {
        // If bucket doesn't exist, try to create it or fall back
        console.warn('Storage upload error (might need bucket creation):', error.message);
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('resumes')
        .getPublicUrl(cleanFileName);

      return publicUrl;
    } catch (err) {
      console.error('Supabase storage upload error, falling back to local file path:', err.message);
    }
  }

  // Local file storage fallback
  try {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const cleanFileName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(uploadDir, cleanFileName);
    fs.writeFileSync(filePath, Buffer.from(fileBuffer));
    
    // Web path
    return `/uploads/${cleanFileName}`;
  } catch (err) {
    console.error('Local file save error:', err);
    return `/mock-resumes/${fileName}`;
  }
}

export function getDbMode() {
  return isSupabaseEnabled ? 'Supabase' : 'Local JSON File';
}
