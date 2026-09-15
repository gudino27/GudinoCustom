import jsPDF from 'jspdf';
import { elementTypes } from '../constants/elementTypes';
import { announce } from '../components/ui/LiveRegion';

//  constants 
const COMPANY_NAME = process.env.REACT_APP_COMPANY_NAME || 'Gudino Custom WoodWorking LLC';
const API_BASE = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';
const originalWalls = [1, 2, 3, 4];

// Professional PDF styling constants
const PDF_STYLES = {
  headerFont: 14,
  titleFont: 16,
  bodyFont: 10,
  smallFont: 8,
  primaryColor: [0, 0, 0],      // Black
  grayColor: [100, 100, 100],   // Gray for secondary text
  lineColor: [0, 0, 0],         // Black lines
  pageMargin: 15,
  lineHeight: 6
};

// Helper to draw a horizontal separator line
const drawSeparator = (pdf, y, margin = PDF_STYLES.pageMargin) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  pdf.setDrawColor(...PDF_STYLES.lineColor);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, pageWidth - margin, y);
  return y + 3;
};

// Professional header for each page
const drawPageHeader = (pdf, clientName, roomName, wallInfo = '', date) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = PDF_STYLES.pageMargin;
  let y = margin;

  // Company name on left
  pdf.setFontSize(PDF_STYLES.headerFont);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...PDF_STYLES.primaryColor);
  pdf.text(COMPANY_NAME, margin, y);

  // Client name on right
  pdf.setFont('helvetica', 'normal');
  pdf.text(clientName, pageWidth - margin, y, { align: 'right' });
  y += 8;

  // Date centered
  pdf.setFontSize(PDF_STYLES.bodyFont);
  pdf.setTextColor(...PDF_STYLES.grayColor);
  pdf.text(date, pageWidth / 2, y, { align: 'center' });
  y += 6;

  // Room/Wall info
  if (roomName) {
    pdf.setFontSize(PDF_STYLES.bodyFont);
    pdf.setTextColor(...PDF_STYLES.primaryColor);
    pdf.text(roomName + (wallInfo ? ` - ${wallInfo}` : ''), margin, y);
    
    // "Not To Scale" on right
    pdf.setFontSize(PDF_STYLES.smallFont);
    pdf.setTextColor(...PDF_STYLES.grayColor);
    pdf.text('Not To Scale', pageWidth - margin, y, { align: 'right' });
    y += 4;
  }

  // Separator line
  y = drawSeparator(pdf, y);
  
  return y;
};

export const generatePDF = async ({
  clientInfo,
  kitchenData,
  bathroomData,
  calculateTotalPrice,
  basePrices,
  materialMultipliers,
  wallPricing
}) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = PDF_STYLES.pageMargin;
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  
  let currentY = drawPageHeader(pdf, clientInfo.name, '', '', date);
  currentY += 10;

  // Title
  pdf.setFontSize(PDF_STYLES.titleFont);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...PDF_STYLES.primaryColor);
  pdf.text('Cabinet Design Quote', pageWidth / 2, currentY, { align: 'center' });
  currentY += 15;

  // Client Information Section
  pdf.setFontSize(PDF_STYLES.bodyFont);
  pdf.setFont('helvetica', 'normal');
  
  // Two column layout for client info
  pdf.text(`Client: ${clientInfo.name}`, margin, currentY);
  pdf.text(`Date: ${date}`, pageWidth - margin, currentY, { align: 'right' });
  currentY += PDF_STYLES.lineHeight;
  
  pdf.text(`Contact: ${clientInfo.contactPreference === 'email' ? clientInfo.email : clientInfo.phone}`, margin, currentY);
  pdf.text(`Method: ${clientInfo.contactPreference}`, pageWidth - margin, currentY, { align: 'right' });
  currentY += 10;

  currentY = drawSeparator(pdf, currentY);
  currentY += 5;

  // Process each room included in quote
  const roomsToInclude = [];
  if (clientInfo.includeKitchen && kitchenData.elements.length > 0) roomsToInclude.push({ name: 'Kitchen', data: kitchenData });
  if (clientInfo.includeBathroom && bathroomData.elements.length > 0) roomsToInclude.push({ name: 'Bathroom', data: bathroomData });

  for (const room of roomsToInclude) {
    // Start new page if needed
    if (currentY > pageHeight - 60) {
      pdf.addPage();
      currentY = drawPageHeader(pdf, clientInfo.name, room.name, '', date);
      currentY += 5;
    }

    // Room header
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(room.name + ' Design', margin, currentY);
    currentY += 8;

    // Room dimensions in a clean format
    pdf.setFontSize(PDF_STYLES.bodyFont);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...PDF_STYLES.grayColor);
    pdf.text(`Dimensions: ${room.data.dimensions.width}' W × ${room.data.dimensions.height}' D × ${room.data.dimensions.wallHeight}" H`, margin, currentY);
    currentY += 10;

    // Cabinet specifications for this room
    const cabinets = room.data.elements.filter(el => el.category === 'cabinet');
    if (cabinets.length > 0) {
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...PDF_STYLES.primaryColor);
      pdf.text('Cabinet Specifications', margin, currentY);
      currentY += 8;

      // Table header
      pdf.setFontSize(PDF_STYLES.smallFont);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...PDF_STYLES.grayColor);
      pdf.text('#', margin, currentY);
      pdf.text('Type', margin + 8, currentY);
      pdf.text('Dimensions', margin + 70, currentY);
      pdf.text('Material', margin + 110, currentY);
      pdf.text('Price', pageWidth - margin, currentY, { align: 'right' });
      currentY += 4;
      currentY = drawSeparator(pdf, currentY);
      currentY += 3;

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...PDF_STYLES.primaryColor);
      pdf.setFontSize(PDF_STYLES.bodyFont);
      
      cabinets.forEach((cabinet, index) => {
        const spec = elementTypes[cabinet.type];
        const material = room.data.materials[cabinet.id] || 'laminate';
        const basePrice = basePrices[cabinet.type] || 250;
        const materialMultiplier = materialMultipliers[material];
        const sizeMultiplier = cabinet.width / 24;
        const price = basePrice * materialMultiplier * sizeMultiplier;

        pdf.text(`${index + 1}`, margin, currentY);
        pdf.text(spec.name || cabinet.type, margin + 8, currentY);
        pdf.text(`${cabinet.width}" × ${cabinet.depth}" × ${cabinet.actualHeight || spec.fixedHeight}"`, margin + 70, currentY);
        pdf.text(material.charAt(0).toUpperCase() + material.slice(1), margin + 110, currentY);
        pdf.text(`$${price.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
        currentY += PDF_STYLES.lineHeight;

        // Check if new page needed
        if (currentY > pageHeight - 25) {
          pdf.addPage();
          currentY = drawPageHeader(pdf, clientInfo.name, room.name, 'Continued', date);
          currentY += 5;
        }
      });

      // Wall modifications for this room
      const removedWalls = room.data.removedWalls || [];
      const chargeableRemoved = removedWalls.filter(wall => originalWalls.includes(wall));
      const customAdded = (room.data.walls || []).filter(wall => !originalWalls.includes(wall));

      if (chargeableRemoved.length > 0 || customAdded.length > 0) {
        currentY += 5;
        pdf.setFontSize(PDF_STYLES.bodyFont);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Wall Modifications:', margin, currentY);
        currentY += PDF_STYLES.lineHeight;

        pdf.setFont('helvetica', 'normal');
        if (chargeableRemoved.length > 0) {
          pdf.text(`• ${chargeableRemoved.length} wall(s) removed`, margin + 5, currentY);
          pdf.text(`$${(chargeableRemoved.length * wallPricing.removeWall).toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
          currentY += PDF_STYLES.lineHeight;
        }

        if (customAdded.length > 0) {
          pdf.text(`• ${customAdded.length} custom wall(s) added`, margin + 5, currentY);
          pdf.text(`$${(customAdded.length * wallPricing.addWall).toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
          currentY += PDF_STYLES.lineHeight;
        }
      }

      // Room subtotal with separator
      currentY += 3;
      currentY = drawSeparator(pdf, currentY);
      currentY += 3;
      
      const roomTotal = calculateTotalPrice(room.data);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${room.name} Subtotal:`, margin, currentY);
      pdf.text(`$${roomTotal.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
      currentY += 15;
    }
  }

  // Grand total calculation
  if (currentY > pageHeight - 50) {
    pdf.addPage();
    currentY = drawPageHeader(pdf, clientInfo.name, 'Summary', '', date);
    currentY += 10;
  }

  // Grand total box
  pdf.setFillColor(245, 245, 245);
  pdf.rect(margin, currentY - 3, pageWidth - margin * 2, 15, 'F');
  
  let grandTotal = 0;
  if (clientInfo.includeKitchen) grandTotal += calculateTotalPrice(kitchenData);
  if (clientInfo.includeBathroom) grandTotal += calculateTotalPrice(bathroomData);

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Total Estimate:', margin + 5, currentY + 7);
  pdf.text(`$${grandTotal.toFixed(2)}`, pageWidth - margin - 5, currentY + 7, { align: 'right' });
  currentY += 20;

  // Disclaimer
  pdf.setFontSize(PDF_STYLES.smallFont);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(...PDF_STYLES.grayColor);
  pdf.text('* This is an estimate. Final pricing may vary based on specific requirements and site conditions.', margin, currentY);
  currentY += 10;

  // Customer comments section
  if (clientInfo.comments) {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...PDF_STYLES.primaryColor);
    pdf.setFontSize(PDF_STYLES.bodyFont);
    pdf.text('Customer Notes:', margin, currentY);
    currentY += PDF_STYLES.lineHeight;
    
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(clientInfo.comments, pageWidth - margin * 2);
    pdf.text(lines, margin, currentY);
  }

  // Save PDF with client name and date
  pdf.save(`cabinet-design-${clientInfo.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);

  // Return PDF blob for potential email attachment
  return pdf.output('blob');
};
const capture3DViews = async (setViewMode, currentRoomData, cameraRef) => {
  const views3D = [];

  // Only capture 3D if there are elements to show
  if (!currentRoomData || !currentRoomData.elements || currentRoomData.elements.length === 0) {
    return views3D;
  }

  try {
    // Switch to 3D view
    setViewMode('3d');
    
    // Wait for 3D scene to fully render
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Find the 3D canvas element
    const canvas3D = document.querySelector('.w-full.h-full.bg-gray-100 canvas') || 
                     document.querySelector('canvas[data-engine]') ||
                     document.querySelector('canvas');

    if (!canvas3D) {
      console.warn('3D canvas not found');
      return views3D;
    }

    // Wall names for labeling
    const wallNames = ['Wall 1 (Top)', 'Wall 2 (Right)', 'Wall 3 (Bottom)', 'Wall 4 (Left)'];
    
    // Capture view for each wall - standing in center looking at each wall
    for (let wall = 1; wall <= 4; wall++) {
      try {
        // Set camera to look at this wall from center of room
        if (cameraRef?.current?.setWallView) {
          cameraRef.current.setWallView(wall);
        }
        
        // Wait for camera to update and scene to re-render
        await new Promise(resolve => setTimeout(resolve, 800));
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Capture the view
        const imageData = canvas3D.toDataURL('image/png', 1.0);
        
        if (imageData && imageData.length > 1000) {
          views3D.push({
            label: wallNames[wall - 1],
            wall: wall,
            image: imageData
          });
          console.log(`Captured 3D view for ${wallNames[wall - 1]}, size:`, imageData.length);
        }
      } catch (err) {
        console.error(`Error capturing wall ${wall}:`, err);
      }
    }

  } catch (error) {
    console.error('Error capturing 3D views:', error);
  }

  return views3D;
};

export const sendQuote = async ({
  t = (key, fallback) => (typeof fallback === 'string' ? fallback : key),
  clientInfo,
  kitchenData,
  bathroomData,
  calculateTotalPrice,
  canvasRef,
  wallViewRef,
  viewMode,
  setViewMode,
  selectedWall,
  setSelectedWall,
  cameraRef  // New: ref to 3D camera controller
}) => {
  // Validate required client information. Errors are returned (and announced)
  // instead of shown in an alert() so they reach assistive tech (WCAG 3.3.1).
  const errors = {};
  if (!clientInfo.name) errors.name = t('forms.error.nameRequired');
  if (!clientInfo.email) errors.email = t('forms.error.emailRequired');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientInfo.email)) errors.email = t('forms.error.emailInvalid');
  if (!clientInfo.phone) errors.phone = t('forms.error.phoneRequired');

  if (Object.keys(errors).length > 0) {
    const message = Object.values(errors).join(' ');
    announce(message);
    return { success: false, errors, message };
  }

  let loadingMessage = null;

  try {
    // Show loading state
    loadingMessage = document.createElement('div');
    loadingMessage.setAttribute('role', 'status');
    loadingMessage.textContent = t('designer.capturing');
    loadingMessage.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); z-index: 1000;';
    document.body.appendChild(loadingMessage);
    announce(t('designer.capturing'));

    // Helper function to capture SVG and convert to canvas for PDF
    const captureSVG = async (svgElement) => {
      if (!svgElement) return null;

      try {
        // Clone the SVG to avoid modifying the original
        const clonedSvg = svgElement.cloneNode(true);

        // Set explicit dimensions if missing
        const rect = svgElement.getBoundingClientRect();
        if (!clonedSvg.getAttribute('width')) {
          clonedSvg.setAttribute('width', rect.width);
        }
        if (!clonedSvg.getAttribute('height')) {
          clonedSvg.setAttribute('height', rect.height);
        }

        // Add white background
        const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        background.setAttribute('width', '100%');
        background.setAttribute('height', '100%');
        background.setAttribute('fill', 'white');
        clonedSvg.insertBefore(background, clonedSvg.firstChild);

        // Convert SVG to canvas for better PDF compatibility
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size
        canvas.width = parseFloat(clonedSvg.getAttribute('width')) || rect.width;
        canvas.height = parseFloat(clonedSvg.getAttribute('height')) || rect.height;

        // Create image from SVG
        const img = new Image();
        const svgData = new XMLSerializer().serializeToString(clonedSvg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        return new Promise((resolve) => {
          img.onload = () => {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            const dataURL = canvas.toDataURL('image/png', 1.0);
            resolve(dataURL);
          };
          img.onerror = () => {
            console.error('Error loading SVG image');
            URL.revokeObjectURL(url);
            resolve(null);
          };
          img.src = url;
        });
      } catch (error) {
        console.error('Error capturing SVG:', error);
        return null;
      }
    };

    // Capture floor plan
    let floorPlanImage = null;
    if (viewMode !== 'floor') {
      setViewMode('floor');
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const floorCanvas = canvasRef.current;
    if (floorCanvas) {
      floorPlanImage = await captureSVG(floorCanvas);
    }

    // Capture wall views
    const wallViewImages = [];
    setViewMode('wall');
    await new Promise(resolve => setTimeout(resolve, 100));

    for (let wall = 1; wall <= 4; wall++) {
      setSelectedWall(wall);
      await new Promise(resolve => setTimeout(resolve, 100));

      const wallCanvas = wallViewRef.current;
      if (wallCanvas) {
        const wallImage = await captureSVG(wallCanvas);
        if (wallImage) {
          wallViewImages.push({
            wall: wall,
            image: wallImage
          });
        }
      }
    }

    // Skip 3D capture to keep PDF file size manageable
    // Return to floor view
    setViewMode('floor');

    loadingMessage.textContent = t('designer.generatingPdf');
    announce(t('designer.generatingPdf'));

    // Generate PDF with professional styling
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = PDF_STYLES.pageMargin;
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    let currentY = drawPageHeader(pdf, clientInfo.name, '', '', date);
    currentY += 5;

    // Title
    pdf.setFontSize(PDF_STYLES.titleFont);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...PDF_STYLES.primaryColor);
    pdf.text('Cabinet Design Quote', pageWidth / 2, currentY, { align: 'center' });
    currentY += 12;

    // Client Information in two columns
    pdf.setFontSize(PDF_STYLES.bodyFont);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Client: ${clientInfo.name}`, margin, currentY);
    pdf.text(`Date: ${date}`, pageWidth - margin, currentY, { align: 'right' });
    currentY += PDF_STYLES.lineHeight;
    pdf.text(`Contact: ${clientInfo.contactPreference === 'email' ? clientInfo.email : clientInfo.phone}`, margin, currentY);
    currentY += 10;

    // Add floor plan to PDF
    if (floorPlanImage) {
      currentY = drawSeparator(pdf, currentY);
      currentY += 3;
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Floor Plan Design', margin, currentY);
      pdf.setFontSize(PDF_STYLES.smallFont);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...PDF_STYLES.grayColor);
      pdf.text('Not To Scale', pageWidth - margin, currentY, { align: 'right' });
      pdf.setTextColor(...PDF_STYLES.primaryColor);
      currentY += 8;

      try {
        pdf.addImage(floorPlanImage, 'PNG', margin, currentY, pageWidth - margin * 2, 90);
        currentY += 100;
      } catch (e) {
        console.error('Error adding floor plan to PDF:', e);
        pdf.text('(Floor plan available in admin panel)', margin, currentY);
        currentY += 10;
      }
    }

    // Calculate totals
    let grandTotal = 0;
    if (clientInfo.includeKitchen) grandTotal += calculateTotalPrice(kitchenData);
    if (clientInfo.includeBathroom) grandTotal += calculateTotalPrice(bathroomData);

    // Add wall views on new page with professional layout
    if (wallViewImages.length > 0) {
      pdf.addPage();
      currentY = drawPageHeader(pdf, clientInfo.name, 'Wall Elevation Views', '', date);
      currentY += 5;

      for (let i = 0; i < wallViewImages.length; i++) {
        if (currentY > pageHeight - 100) {
          pdf.addPage();
          currentY = drawPageHeader(pdf, clientInfo.name, 'Wall Elevation Views', 'Continued', date);
          currentY += 5;
        }

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Wall ${wallViewImages[i].wall}`, margin, currentY);
        pdf.setFontSize(PDF_STYLES.smallFont);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...PDF_STYLES.grayColor);
        pdf.text('Not To Scale', pageWidth - margin, currentY, { align: 'right' });
        pdf.setTextColor(...PDF_STYLES.primaryColor);
        currentY += 5;

        try {
          pdf.addImage(wallViewImages[i].image, 'PNG', margin, currentY, pageWidth - margin * 2, 75);
          currentY += 85;
        } catch (e) {
          console.error('Error adding wall view to PDF:', e);
          pdf.text('(Wall view available in admin panel)', margin, currentY);
          currentY += 10;
        }
      }
    }

    // Add specifications page
    pdf.addPage();
    currentY = drawPageHeader(pdf, clientInfo.name, 'Cabinet Specifications', '', date);
    currentY += 5;

    // Process each room
    const roomsToInclude = [];
    if (clientInfo.includeKitchen && kitchenData.elements.length > 0) {
      roomsToInclude.push({ name: 'Kitchen', data: kitchenData });
    }
    if (clientInfo.includeBathroom && bathroomData.elements.length > 0) {
      roomsToInclude.push({ name: 'Bathroom', data: bathroomData });
    }

    for (const room of roomsToInclude) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${room.name}`, margin, currentY);
      pdf.setFontSize(PDF_STYLES.bodyFont);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...PDF_STYLES.grayColor);
      pdf.text(`${room.data.dimensions.width}' W × ${room.data.dimensions.height}' D`, margin + 50, currentY);
      pdf.setTextColor(...PDF_STYLES.primaryColor);
      currentY += 8;

      const cabinets = room.data.elements.filter(el => el.category === 'cabinet');

      // Table header
      pdf.setFontSize(PDF_STYLES.smallFont);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...PDF_STYLES.grayColor);
      pdf.text('#', margin, currentY);
      pdf.text('Cabinet Type', margin + 8, currentY);
      pdf.text('Dimensions', margin + 80, currentY);
      pdf.text('Material', margin + 130, currentY);
      currentY += 3;
      currentY = drawSeparator(pdf, currentY);
      currentY += 3;

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...PDF_STYLES.primaryColor);
      pdf.setFontSize(PDF_STYLES.bodyFont);

      cabinets.forEach((cabinet, index) => {
        const material = room.data.materials[cabinet.id] || 'laminate';
        pdf.text(`${index + 1}`, margin, currentY);
        pdf.text(cabinet.type, margin + 8, currentY);
        pdf.text(`${cabinet.width}" × ${cabinet.depth}"`, margin + 80, currentY);
        pdf.text(material.charAt(0).toUpperCase() + material.slice(1), margin + 130, currentY);
        currentY += PDF_STYLES.lineHeight;

        if (currentY > pageHeight - 30) {
          pdf.addPage();
          currentY = drawPageHeader(pdf, clientInfo.name, 'Cabinet Specifications', 'Continued', date);
          currentY += 5;
        }
      });

      currentY += 3;
      currentY = drawSeparator(pdf, currentY);
      currentY += 3;

      const roomTotal = calculateTotalPrice(room.data);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${room.name} Subtotal:`, margin, currentY);
      pdf.text(`$${roomTotal.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
      currentY += 12;
    }

    // Grand total box
    if (currentY > pageHeight - 40) {
      pdf.addPage();
      currentY = drawPageHeader(pdf, clientInfo.name, 'Summary', '', date);
      currentY += 10;
    }
    
    pdf.setFillColor(245, 245, 245);
    pdf.rect(margin, currentY - 3, pageWidth - margin * 2, 15, 'F');
    
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Total Estimate:', margin + 5, currentY + 7);
    pdf.text(`$${grandTotal.toFixed(2)}`, pageWidth - margin - 5, currentY + 7, { align: 'right' });

    // Get PDF blob
    const pdfBlob = pdf.output('blob');

    loadingMessage.textContent = t('designer.sending');
    announce(t('designer.sending'));

    // Create form data
    const formData = new FormData();
    formData.append('pdf', pdfBlob, 'design.pdf');

    // Design data with images
    const designData = {
      client_name: clientInfo.name,
      client_email: clientInfo.email || '',
      client_phone: clientInfo.phone || '',
      contact_preference: clientInfo.contactPreference,
      kitchen_data: clientInfo.includeKitchen ? kitchenData : null,
      bathroom_data: clientInfo.includeBathroom ? bathroomData : null,
      include_kitchen: clientInfo.includeKitchen,
      include_bathroom: clientInfo.includeBathroom,
      total_price: grandTotal,
      comments: clientInfo.comments || '',
      floor_plan_image: floorPlanImage,
      wall_view_images: wallViewImages
    };

    // //console.log('Sending design:', {
    //   hasFloorPlan: !!floorPlanImage,
    //   wallViews: wallViewImages.length,
    //   dataSize: JSON.stringify(designData).length
    // });

    formData.append('designData', JSON.stringify(designData));

    // Send to backend
    const response = await fetch(`${API_BASE}/api/designs`, {
      method: 'POST',
      body: formData
    });

    document.body.removeChild(loadingMessage);

    if (response.ok) {
      await response.json();

      const sentMessage = t('designer.sent', { company: COMPANY_NAME });
      announce(sentMessage);

      // Reset client info (return the reset object)
      const resetClientInfo = {
        name: '',
        email: '',
        phone: '',
        contactPreference: 'email',
        includeKitchen: true,
        includeBathroom: false,
        comments: ''
      };

      // Confirm success and offer the download in one accessible dialog
      if (window.confirm(`${sentMessage} ${t('designer.downloadCopy')}`)) {
        pdf.save(`cabinet-design-${clientInfo.name.replace(/\s+/g, '-')}.pdf`);
      }

      return { success: true, resetClientInfo, message: sentMessage };
    } else {
      throw new Error('Failed to send design');
    }

  } catch (error) {
    console.error('Error:', error);
    // Make sure the progress overlay never stays behind on failure
    if (loadingMessage && loadingMessage.parentNode) {
      loadingMessage.parentNode.removeChild(loadingMessage);
    }
    const message = t('designer.sendFailed');
    announce(message);
    return { success: false, message };
  }
};