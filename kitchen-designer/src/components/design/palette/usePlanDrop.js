import { useCallback, useEffect, useRef, useState } from 'react';
import { announce } from '../../ui/LiveRegion';
import { getElementName } from '../elementName';
import { snapToCabinet, snapToWall } from '../../../utils/designer/snappingUtils';
import { snapToWallFace } from '../../../utils/designer/wallFaces';
import {
  checkWallCollision as wallHelpersCollision,
  pushAwayFromWall as wallHelpersPush,
} from '../../../utils/wallHelpers';
import { paletteDrag } from './paletteDrag';
import {
  clientToPlan,
  isPointInBox,
  planRectToClient,
  resolveDrop,
  standardWallsFor,
} from './dropPlacement';

/**
 * Drop target for items dragged from the palette onto the floor plan.
 *
 * Returns
 *   preview        null or { box: {left, top, width, height} relative to the
 *                  plan container, allowed, reason, name }
 *   containerProps HTML5 drag handlers for the plan container (mouse drags)
 *
 * Touch drags come in through paletteDrag (the palette sends pointer moves).
 * The drop goes through addElement(type, target): a blocked spot falls back
 * to the nearest free one, the same as clicking the item.
 */
export const usePlanDrop = ({
  canvasRef,
  containerRef,
  currentRoomData,
  customWalls = [],
  elementTypes,
  scale,
  checkDoorClearanceCollision,
  addElement,
  t,
}) => {
  const [preview, setPreview] = useState(null);

  // The drop handlers live in a long-lived subscription: read fresh values
  // through a ref instead of re-subscribing on every render
  const live = useRef({});
  live.current = { currentRoomData, customWalls, elementTypes, scale, checkDoorClearanceCollision, addElement, t };

  // The same snap chain the plan uses while dragging a placed item: a drawn
  // or pantry wall first (back to it, turned to face away, on whichever side
  // it is dropped), then other cabinets, then the room walls
  const snap = useCallback((x, y, width, depth, candidate) => {
    const { currentRoomData: room, customWalls: walls, scale: s } = live.current;
    if (candidate) {
      const face = snapToWallFace({
        element: candidate,
        center: { x: x + width / 2, y: y + depth / 2 },
        roomData: { ...room, customWalls: walls },
        scale: s,
      });
      if (face.snapped) return face;
    }
    let position = snapToCabinet(x, y, width, depth, null, 0, room.elements, s);
    if (!position.snapped) {
      position = snapToWall(
        x, y, width, depth, room, s,
        standardWallsFor(room, s),
        wallHelpersCollision,
        wallHelpersPush
      );
    }
    return position;
  }, []);

  // Where `type` would land for a pointer at (clientX, clientY), or null
  // when the pointer is not over the plan
  const decisionAt = useCallback((type, clientX, clientY) => {
    const svg = canvasRef.current;
    if (!svg || clientX == null || clientY == null) return null;
    if (!isPointInBox(clientX, clientY, svg.getBoundingClientRect())) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const { currentRoomData: room, elementTypes: types, scale: s, checkDoorClearanceCollision: door } = live.current;
    const point = clientToPlan(clientX, clientY, ctm.inverse());
    return resolveDrop({
      type,
      point,
      roomData: room,
      elementTypes: types,
      scale: s,
      snap,
      isBlocked: door,
    });
  }, [canvasRef, snap]);

  const showPreview = useCallback((type, clientX, clientY) => {
    const decision = decisionAt(type, clientX, clientY);
    const svg = canvasRef.current;
    const container = containerRef.current;
    if (!decision || !svg || !container) {
      setPreview(null);
      return;
    }
    const screen = planRectToClient(decision, svg.getScreenCTM());
    const origin = container.getBoundingClientRect();
    const { t: tr, elementTypes: types } = live.current;
    setPreview({
      box: {
        left: screen.left - origin.left,
        top: screen.top - origin.top,
        width: screen.width,
        height: screen.height,
      },
      allowed: decision.allowed,
      reason: decision.reason,
      name: getElementName(tr, type, types),
    });
  }, [canvasRef, containerRef, decisionAt]);

  useEffect(() => paletteDrag.subscribe((event) => {
    if (event.phase === 'move') {
      showPreview(event.type, event.clientX, event.clientY);
      return false;
    }
    if (event.phase === 'cancel' || event.phase === 'start') {
      setPreview(null);
      return false;
    }
    if (event.phase !== 'drop') return false;
    setPreview(null);
    const decision = decisionAt(event.type, event.clientX, event.clientY);
    if (!decision) return false; // released off the plan
    const { addElement: add, t: tr, elementTypes: types } = live.current;
    const name = getElementName(tr, event.type, types);
    const placed = add(event.type, {
      x: decision.x,
      y: decision.y,
      rotation: decision.rotation,
      snapped: decision.snapped,
    });
    // null: nothing free anywhere; addElement already said so
    if (placed) {
      const atTarget = decision.allowed && placed.x === decision.x && placed.y === decision.y;
      announce(tr(atTarget ? 'designer.palette.dropped' : 'designer.palette.droppedNearby', { name }));
    }
    return true;
  }), [decisionAt, showPreview]);

  // HTML5 drag and drop (mouse): only react to drags that came from the palette
  const containerProps = {
    onDragEnter: (e) => {
      if (!paletteDrag.get()) return;
      e.preventDefault();
    },
    onDragOver: (e) => {
      if (!paletteDrag.get()) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      paletteDrag.move(e.clientX, e.clientY);
    },
    onDragLeave: (e) => {
      if (!paletteDrag.get()) return;
      if (e.currentTarget.contains(e.relatedTarget)) return;
      setPreview(null);
    },
    onDrop: (e) => {
      if (!paletteDrag.get()) return;
      e.preventDefault();
      paletteDrag.drop(e.clientX, e.clientY);
    },
  };

  return { preview, containerProps };
};
