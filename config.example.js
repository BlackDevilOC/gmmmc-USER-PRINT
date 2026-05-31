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
  /** Extra px for compact letterhead inside each print page header (standard A4) */
  letterheadHeaderExtra: 50,
  /** Optional overrides — portal uses standard A4 margins by default, not lab desk settings */
  printSettings: {},
};
