/** Copy to config.js and adjust for your Supabase project. Do NOT put service_role here. */
window.LABFLOW_PORTAL_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  functionName: "patient-portal",
  hospitalName: "Your Hospital Name",
  hospitalTitle: "YOUR HOSPITAL NAME",
  hospitalNameUr: "",
  hospitalPhone: "",
  logoLeft: "images/hospital_logo.png",
  logoRight: "images/logo.png",
  basePath: "",
  /** Extra px added to header_height for compact letterhead on each print page */
  letterheadHeaderExtra: 72,
  /** Optional — override lab print_settings (same keys as main LabFlow app) */
  printSettings: {},
};
