const formatDateString = (dateStr) => {
  if (!dateStr && dateStr !== 0) return null;
  
  // If it's a string that looks like a number, convert it to a number first
  if (typeof dateStr === 'string' && !isNaN(dateStr) && dateStr.trim() !== '') {
    dateStr = parseFloat(dateStr);
  }
  
  // Handle Excel serial numbers (whether passed as numbers or strings)
  if (typeof dateStr === 'number') {
    const utc_days = Math.floor(dateStr - 25569);
    const utc_value = utc_days * 86400;        
    const date_info = new Date(utc_value * 1000);
    if (!isNaN(date_info.getTime())) {
      return `${date_info.getFullYear()}-${String(date_info.getMonth() + 1).padStart(2, '0')}-${String(date_info.getDate()).padStart(2, '0')}`;
    }
  }
  
  // Strip time part if it exists (e.g., "1/30/23 12:00 AM" -> "1/30/23")
  const cleanStr = String(dateStr).trim().split(' ')[0];
  
  // Try standard DD/MM/YYYY or MM/DD/YYYY
  const parts = cleanStr.split(/[-/]/);
  if (parts.length === 3) {
    let [p1, p2, p3] = parts.map(p => parseInt(p, 10));
    if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
      if (p3 < 100) p3 = 2000 + p3;
      let dateObj = new Date(p3, p2 - 1, p1);
      if (p2 > 12 && p1 <= 12) dateObj = new Date(p3, p1 - 1, p2);
      if (!isNaN(dateObj.getTime())) {
        return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      }
    }
  }
  
  // Fallback to Date object
  const fallbackDate = new Date(cleanStr);
  if (!isNaN(fallbackDate.getTime())) {
    const year = fallbackDate.getFullYear();
    if (year > 1900 && year < 2100) {
      return `${year}-${String(fallbackDate.getMonth() + 1).padStart(2, '0')}-${String(fallbackDate.getDate()).padStart(2, '0')}`;
    }
  }
  return null;
};