import React, { useState, useEffect, useRef, useId } from 'react';
import { Box, ArrowLeft, RotateCw, Move, Palette, X } from 'lucide-react';
import DesignEditor3D from './DesignEditor3D';
import { PAINTS, STAINS, FINISHES, APPLIANCE_MATERIALS, GRAIN_TYPES } from '../../constants/materials';
import { useLanguage } from '../../contexts/LanguageContext';
import { getElementName } from './elementName';

const Designer3D = ({ 
    roomData, 
    setRoomData, 
    elementTypes, 
    activeRoom,
    scale: parentScale,
    selectedElement: parentSelectedElement,
    setSelectedElement: parentSetSelectedElement,
    updateElement: parentUpdateElement,
    onClose,
    cameraRef  // New: ref for external camera control
}) => {
    const [localScale, setLocalScale] = useState(1);
    const [interactive, setInteractive] = useState(true);
    const [internalSelectedElement, setInternalSelectedElement] = useState(null);
    const [tempElementState, setTempElementState] = useState(null);
    const { t } = useLanguage();
    const uid = useId();

    // Use provided cameraRef or create internal one
    const internalCameraRef = useRef();
    const actualCameraRef = cameraRef || internalCameraRef;

    // Use parent's selection if provided, otherwise use internal state
    const selectedElement = parentSelectedElement !== undefined ? parentSelectedElement : internalSelectedElement;
    const setSelectedElement = parentSetSelectedElement || setInternalSelectedElement;

    // Reset temp state when selection changes
    useEffect(() => {
        setTempElementState(null); 
    }, [selectedElement]);

    // Use parent scale if provided, otherwise calculate locally
    const scale = parentScale || localScale;

    // Calculate scale based on room dimensions (only if parent doesn't provide it)
    useEffect(() => {
        if (!parentScale && roomData && roomData.dimensions) {
            const roomWidthFeet = parseFloat(roomData.dimensions.width) || 10;
            const roomHeightFeet = parseFloat(roomData.dimensions.height) || 10;
            const roomWidthInches = roomWidthFeet * 12;
            const roomHeightInches = roomHeightFeet * 12;
            const maxCanvasSize = 600;
            
            const scaleX = maxCanvasSize / roomWidthInches;
            const scaleY = maxCanvasSize / roomHeightInches;
            
            setLocalScale(Math.min(scaleX, scaleY));
        }
    }, [roomData, parentScale]);

    const handleUpdateElement = (elementId, updates) => {
        console.log('handleUpdateElement called:', elementId, updates);
        // Use parent's updateElement if provided, otherwise update locally
        if (parentUpdateElement) {
            parentUpdateElement(elementId, updates);
        } else {
            if (!roomData || !roomData.elements) return;

            const elementIndex = roomData.elements.findIndex(el => el.id === elementId);
            if (elementIndex === -1) return;

            const newElements = [...roomData.elements];
            newElements[elementIndex] = { ...newElements[elementIndex], ...updates };
            
            setRoomData({ ...roomData, elements: newElements });
        }
    };

    if (!roomData) return null;

    console.log('Designer3D rendering. Mode:', interactive ? 'Interactive' : 'View Only');
    if (selectedElement) {
        const el = roomData.elements.find(e => e.id === selectedElement);
        console.log('Selected Element Data:', el);
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
            {/* Toolbar */}
            <div className="flex-none flex items-center justify-between p-4 bg-white border-b shadow-sm ">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft aria-hidden="true" size={20} />
                        <span className="font-medium">{t('designer.backTo2D')}</span>
                    </button>
                    <div className="h-6 w-px bg-gray-300"></div>
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <Box aria-hidden="true" className="text-blue-700" size={24} />
                        {t('designer.editor3DHeading', {
                            room: activeRoom === 'kitchen' ? t('designer.kitchen') : t('designer.bathroom')
                        })}
                    </h2>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-700 mr-2">
                        <span className="font-medium text-gray-700">{roomData.elements.length}</span> {t('designer.items')}
                    </div>
                    <button
                        type="button"
                        onClick={() => setInteractive(!interactive)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            interactive
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : 'bg-white text-gray-700 border border-gray-500 hover:bg-gray-50'
                        }`}
                    >
                        {/* The visible text already is the state, so no aria-pressed:
                            it would duplicate a name that changes (WCAG 4.1.2) */}
                        {interactive ? t('designer.interactiveModeOn') : t('designer.viewOnly')}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Main 3D View */}
                <div className="flex-1 relative bg-gray-100">
                    <DesignEditor3D 
                        roomData={roomData}
                        elementTypes={elementTypes}
                        scale={scale}
                        interactive={interactive}
                        selectedElement={selectedElement}
                        setSelectedElement={setSelectedElement}
                        onUpdateElement={handleUpdateElement}
                        onTransformChange={(id, updates) => {
                            if (id === selectedElement) {
                                setTempElementState(prev => ({ ...prev, ...updates }));
                            }
                        }}
                        cameraRef={actualCameraRef}
                    />
                    
                    {/* Overlay Instructions */}
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur p-3 rounded-lg shadow-sm border border-gray-100 max-w-xs pointer-events-none">
                        <h3 className="font-semibold text-gray-800 mb-2 text-sm">{t('designer.controls')}</h3>
                        <ul className="text-xs text-gray-700 space-y-1">
                            <li className="flex items-center gap-2">
                                <Move aria-hidden="true" size={14} /> {t('designer.controlMoveCamera')}
                            </li>
                            <li className="flex items-center gap-2">
                                <RotateCw aria-hidden="true" size={14} /> {t('designer.controlRotateCamera')}
                            </li>
                            <li className="flex items-center gap-2">
                                {t('designer.controlZoom')}
                            </li>
                            {interactive && (
                                <li className="mt-2 pt-2 border-t border-gray-200 font-medium text-blue-700">
                                    {t('designer.controlSelect')}
                                </li>
                            )}
                        </ul>
                    </div>
                </div>

                {/* Right Sidebar - Properties */}
                {interactive && (
                    <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto shadow-xl z-10 flex flex-col">
                        {selectedElement ? (() => {
                            const baseElement = roomData.elements.find(el => el.id == selectedElement);
                            // Merge base element with temp state for real-time updates
                            const element = { ...baseElement, ...tempElementState };
                            const spec = elementTypes[element.type] || {};
                            const showElevation = spec.mountHeight !== undefined || spec.isFloating;
                            
                            const isAppliance = element?.category === 'appliance';
                            const isStain = element?.materialId && STAINS.find(s => s.id === element.materialId);
                            
                            return (
                            <div className="p-4">
                                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
                                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                        <Palette aria-hidden="true" size={18} className="text-blue-700" />
                                        {t('designer.properties')}
                                        <span className="sr-only">
                                            {` – ${getElementName(t, element.type, elementTypes)}`}
                                        </span>
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedElement(null)}
                                        className="text-gray-600 hover:text-gray-800 transition-colors"
                                        aria-label={t('designer.deselect')}
                                        title={t('designer.deselect')}
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Position & Rotation Info */}
                                <div className="mb-6 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">{t('designer.transform')}</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between items-center">
                                            <label htmlFor={`${uid}-rotation`} className="text-gray-700">{t('designer.rotation')}:</label>
                                            <div className="flex items-center">
                                                <input
                                                    id={`${uid}-rotation`}
                                                    type="number"
                                                    value={Math.round(element.rotation || 0)}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value);
                                                        if (!isNaN(val)) {
                                                            handleUpdateElement(selectedElement, { rotation: val });
                                                        } else {
                                                            handleUpdateElement(selectedElement, { rotation: 0 });
                                                        }
                                                    }}
                                                    className="w-20 p-1 text-right font-mono font-medium border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                                <span aria-hidden="true" className="ml-1 text-gray-700 w-4">°</span>
                                            </div>
                                        </div>
                                        {showElevation && (
                                            <div className="flex justify-between items-center">
                                                <label htmlFor={`${uid}-elevation`} className="text-gray-700">{t('designer.elevation')}:</label>
                                                <div className="flex items-center">
                                                    <input
                                                        id={`${uid}-elevation`}
                                                        type="number"
                                                        value={Math.round(element.mountHeight || 0)}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value);
                                                            if (!isNaN(val)) {
                                                                handleUpdateElement(selectedElement, { mountHeight: val });
                                                            } else {
                                                                handleUpdateElement(selectedElement, { mountHeight: 0 });
                                                            }
                                                        }}
                                                        className="w-20 p-1 text-right font-mono font-medium border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                    />
                                                    <span aria-hidden="true" className="ml-1 text-gray-700 w-4">"</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {isAppliance ? (
                                    /* Appliance Finishes */
                                    <div className="mb-8">
                                        <h4 id={`${uid}-appliance-finish`} className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">{t('designer.applianceFinish')}</h4>
                                        <div className="grid grid-cols-4 gap-3" role="group" aria-labelledby={`${uid}-appliance-finish`}>
                                            {APPLIANCE_MATERIALS.map(mat => (
                                                <button
                                                    type="button"
                                                    key={mat.id}
                                                    onClick={() => handleUpdateElement(selectedElement, { materialId: mat.id })}
                                                    aria-pressed={element.materialId === mat.id}
                                                    aria-label={mat.name}
                                                    className={`w-full aspect-square rounded-full border shadow-sm hover:scale-110 transition-all relative group ${element.materialId === mat.id ? 'ring-2 ring-blue-700 ring-offset-2' : 'border-gray-500'}`}
                                                    style={{ backgroundColor: mat.hex }}
                                                    title={mat.name}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    /* Cabinet Finishes */
                                    <>
                                        {/* Paints */}
                                        <div className="mb-8">
                                            <h4 id={`${uid}-paints`} className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 flex justify-between items-center">
                                                {t('designer.realWorldPaints')}
                                                <span className="text-[10px] font-normal text-gray-600">SW &amp; BM</span>
                                            </h4>
                                            <div className="grid grid-cols-5 gap-3" role="group" aria-labelledby={`${uid}-paints`}>
                                                {PAINTS.map(paint => (
                                                    <button
                                                        type="button"
                                                        key={paint.id}
                                                        onClick={() => handleUpdateElement(selectedElement, { materialId: paint.id })}
                                                        aria-pressed={element.materialId === paint.id}
                                                        aria-label={`${paint.brand} – ${paint.name}`}
                                                        className={`w-full aspect-square rounded-full border shadow-sm hover:scale-110 transition-all relative group ${element.materialId === paint.id ? 'ring-2 ring-blue-700 ring-offset-2' : 'border-gray-500'}`}
                                                        style={{ backgroundColor: paint.hex }}
                                                        title={`${paint.brand} - ${paint.name}`}
                                                    >
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Stains */}
                                        <div className="mb-8">
                                            <h4 id={`${uid}-stains`} className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">{t('designer.woodStains')}</h4>
                                            <div className="grid grid-cols-5 gap-3" role="group" aria-labelledby={`${uid}-stains`}>
                                                {STAINS.map(stain => (
                                                    <button
                                                        type="button"
                                                        key={stain.id}
                                                        onClick={() => handleUpdateElement(selectedElement, { materialId: stain.id })}
                                                        aria-pressed={element.materialId === stain.id}
                                                        aria-label={stain.name}
                                                        className={`w-full aspect-square rounded-full border shadow-sm hover:scale-110 transition-all relative group ${element.materialId === stain.id ? 'ring-2 ring-blue-700 ring-offset-2' : 'border-gray-500'}`}
                                                        style={{ backgroundColor: stain.hex }}
                                                        title={stain.name}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        
                                        {/* Wood Grain Selector (Only if stain is selected) */}
                                        {isStain && (
                                            <div className="mb-8">
                                                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                                                    <label htmlFor={`${uid}-grain`}>{t('designer.woodGrainPattern')}</label>
                                                </h4>
                                                <select
                                                    id={`${uid}-grain`}
                                                    className="w-full p-2 border border-gray-500 rounded text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                    onChange={(e) => handleUpdateElement(selectedElement, { grain: e.target.value })}
                                                    value={element.grain || isStain.defaultGrain || 'oak'}
                                                >
                                                    {Object.values(GRAIN_TYPES).map((grain) => (
                                                        <option key={grain.id} value={grain.id}>{grain.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        
                                        {/* Finishes */}
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                                                <label htmlFor={`${uid}-finish`}>{t('designer.finishSheen')}</label>
                                            </h4>
                                            <select
                                                id={`${uid}-finish`}
                                                className="w-full p-2 border border-gray-500 rounded text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                onChange={(e) => handleUpdateElement(selectedElement, { finish: e.target.value })}
                                                defaultValue="satin"
                                                value={element.finish || 'satin'}
                                            >
                                                {Object.entries(FINISHES).map(([key, finish]) => (
                                                    <option key={key} value={key}>{finish.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>
                            );
                        })() : (
                            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-700">
                                <Box aria-hidden="true" size={48} className="mb-4 opacity-20" />
                                <p className="text-sm font-medium text-gray-700">{t('designer.noItemSelected')}</p>
                                <p className="text-xs mt-1">{t('designer.noItemSelectedHint')}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
export default Designer3D;