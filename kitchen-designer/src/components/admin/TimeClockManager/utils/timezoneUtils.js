// Timezone constant
export const TIMEZONE = "America/Los_Angeles"; // PST/PDT

// Parse PST timestamp string to Date object
export const parsePSTTimestamp = (pstTimestamp) => {
  if (!pstTimestamp) return null;
  const isoString = pstTimestamp.replace(" ", "T") + "Z";
  return new Date(isoString);
};

// Helper to convert UTC to PST and format time
export const formatTimePST = (dateTimeStr, formatStr = "h:mm A") => {
  if (!dateTimeStr) return "--:--";
  // If it's a PST timestamp from database (no timezone info), parse it as UTC then format as PST
  let date;
  if (
    typeof dateTimeStr === "string" &&
    dateTimeStr.match(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/)
  ) {
    const parts = dateTimeStr.split(/[- :T]/);
    date = new Date(
      Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5] || 0)
    );
  } else {
    date = new Date(dateTimeStr);
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

// Format date in PST
export const formatDatePST = (dateTimeStr) => {
  if (!dateTimeStr) return "";
  let date;
  if (
    typeof dateTimeStr === "string" &&
    dateTimeStr.match(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/)
  ) {
    // Database format: "2025-10-19 18:08:00" - this IS the PST time
    const parts = dateTimeStr.split(/[- :T]/);
    date = new Date(
      Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5] || 0)
    );
  } else if (
    typeof dateTimeStr === "string" &&
    dateTimeStr.match(/^\d{4}-\d{2}-\d{2}$/)
  ) {
    // Date only format: "2025-10-19"
    const parts = dateTimeStr.split("-");
    date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0));
  } else {
    date = new Date(dateTimeStr);
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
};

// Format full date and time in PST
export const formatDateTimePST = (dateTimeStr) => {
  if (!dateTimeStr) return "";
  // If it's a PST timestamp from database (no timezone info), parse it correctly
  let date;
  if (
    typeof dateTimeStr === "string" &&
    dateTimeStr.match(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/)
  ) {
    const parts = dateTimeStr.split(/[- :T]/);
    date = new Date(
      Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5] || 0)
    );
  } else {
    date = new Date(dateTimeStr);
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

// Helper to get current date in PST as YYYY-MM-DD string
export const getTodayPST = () => {
  const now = new Date();
  const pstDate = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  // Convert from MM/DD/YYYY to YYYY-MM-DD
  const [month, day, year] = pstDate.split("/");
  return `${year}-${month}-${day}`;
};

// Helper to convert a date to PST date string (YYYY-MM-DD)
export const toPSTDateString = (date) => {
  const pstDate = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  // Convert from MM/DD/YYYY to YYYY-MM-DD
  const [month, day, year] = pstDate.split("/");
  return `${year}-${month}-${day}`;
};

// Extract the date portion from a PST timestamp
export const extractPSTDate = (pstTimestamp) => {
  if (!pstTimestamp) return "";
  // Extract the date portion (YYYY-MM-DD) before the space or 'T'
  // Handle both "2025-10-19 18:08:00" and "2025-10-19T12:26:00" formats
  if (pstTimestamp.includes(" ")) {
    return pstTimestamp.split(" ")[0];
  } else if (pstTimestamp.includes("T")) {
    return pstTimestamp.split("T")[0];
  }
  return pstTimestamp;
};
