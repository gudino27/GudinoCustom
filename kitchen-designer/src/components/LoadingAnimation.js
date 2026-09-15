import React from 'react';

// This renders before the app chunk (and so before LanguageProvider) loads, so
// t() is not available. The inline script in public/index.html has already put
// the saved language on <html lang>, so read the strings from there.
const LOADING_TEXT = {
  en: 'Crafting Your Experience',
  es: 'Creando Tu Experiencia'
};

const LoadingAnimation = () => {
  const lang = document.documentElement.lang === 'es' ? 'es' : 'en';

  return (
    <div style={{ 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh', 
      display: 'flex', 
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
      flexDirection: 'column',
      gap: '30px',
      overflow: 'hidden',
      padding: '20px'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Courgette&family=Allura:wght@400;700&display=swap');
        
        @keyframes buildFrame {
          0%, 100% { 
            height: 0; 
            opacity: 0;
            transform: scaleY(0);
          }
          20%, 80% { 
            height: 100%; 
            opacity: 1;
            transform: scaleY(1);
          }
        }
        @keyframes slideShelf {
          0%, 100% { 
            transform: translateX(-150%) scaleX(0.5); 
            opacity: 0; 
          }
          12% {
            transform: translateX(5%) scaleX(1.02);
          }
          25%, 75% { 
            transform: translateX(0) scaleX(1); 
            opacity: 1; 
          }
          88% {
            transform: translateX(5%) scaleX(1.02);
          }
        }
        @keyframes swingDoor {
          0%, 100% { 
            transform: perspective(600px) rotateY(-95deg); 
            opacity: 0; 
          }
          17% {
            transform: perspective(600px) rotateY(5deg);
          }
          20% {
            transform: perspective(600px) rotateY(-2deg);
          }
          35%, 65% { 
            transform: perspective(600px) rotateY(0deg); 
            opacity: 1; 
          }
          80% {
            transform: perspective(600px) rotateY(-2deg);
          }
          83% {
            transform: perspective(600px) rotateY(5deg);
          }
        }
        @keyframes fadeIn {
          0% { opacity: 0; transform: scale(0.9) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-12px) rotate(-8deg); }
          50% { transform: translateY(-5px) rotate(3deg); }
          75% { transform: translateY(-12px) rotate(8deg); }
        }
        @keyframes textBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        @keyframes sawdust {
          0% { 
            opacity: 0; 
            transform: translateY(0) scale(0); 
          }
          50% { 
            opacity: 0.6; 
            transform: translateY(20px) scale(1) rotate(45deg); 
          }
          100% { 
            opacity: 0; 
            transform: translateY(40px) scale(0.5) rotate(90deg); 
          }
        }
        @keyframes shine {
          0% { 
            background-position: -200% center; 
          }
          100% { 
            background-position: 200% center; 
          }
        }
      `}</style>
      
      {/* Company Name with Curved Arc Text */}
      <div style={{
        textAlign: 'center',
        animation: 'fadeIn 1s ease-out 0.3s backwards, textBounce 2s ease-in-out 1s infinite',
        marginBottom: '10px',
        position: 'relative',
        height: '110px'
      }}>
        <svg viewBox="0 0 500 130" style={{ width: '100%', maxWidth: '500px', height: 'auto' }}>
          {/* Arc path for GUDINO - curves up */}
          <path 
            id="curve1" 
            d="M 50,95 Q 250,15 450,95" 
            fill="transparent"
          />
          <text style={{ 
            fill: '#fff', 
            fontSize: '70px', 
            fontFamily: 'Courgette',
            letterSpacing: '6px',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.6))'
          }}>
            <textPath href="#curve1" startOffset="50%" textAnchor="middle">
              GUDINO
            </textPath>
          </text>
          
          {/* Arc path for CUSTOM WOODWORKING - curves up slightly */}
          <path 
            id="curve2" 
            d="M 20,115 Q 250,75 480,115" 
            fill="transparent"
          />
          <text style={{ 
            fill: '#fff', 
            fontSize: '30px', 
            fontFamily: 'Allura, bold',
            fontWeight: '900',
            letterSpacing: '4px',
            filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.5))'
          }}>
            <textPath href="#curve2" startOffset="50%" textAnchor="middle">
              CUSTOM WOODWORKING
            </textPath>
          </text>
        </svg>
      </div>

      {/* Cabinet Building Animation - decoration, not content */}
      <div aria-hidden="true" style={{
        position: 'relative',
        width: '220px',
        height: '260px',
        perspective: '1200px',
        filter: 'drop-shadow(0 15px 35px rgba(0,0,0,0.5))'
      }}>
        {/* Cabinet Frame with realistic wood */}
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '6px',
          background: `
            linear-gradient(135deg, 
              #8B4513 0%, 
              #A0522D 15%, 
              #8B4513 30%,
              #6B3410 50%,
              #8B4513 70%,
              #A0522D 85%,
              #8B4513 100%
            )
          `,
          boxShadow: `
            inset -3px -3px 8px rgba(0,0,0,0.6),
            inset 3px 3px 8px rgba(139,69,19,0.3),
            0 20px 40px rgba(0,0,0,0.6)
          `,
          animation: 'buildFrame 5s cubic-bezier(0.34, 1.56, 0.64, 1) infinite',
          transformOrigin: 'bottom',
          border: '10px solid #6B3410'
        }}>
          {/* Realistic wood grain texture */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `
              repeating-linear-gradient(
                90deg,
                transparent 0px,
                rgba(107, 52, 16, 0.15) 1px,
                transparent 2px,
                transparent 8px,
                rgba(139, 69, 19, 0.25) 9px,
                transparent 10px
              ),
              repeating-linear-gradient(
                0deg,
                transparent 0px,
                rgba(107, 52, 16, 0.08) 2px,
                transparent 4px
              )
            `,
            opacity: 0.8,
            pointerEvents: 'none',
            mixBlendMode: 'multiply'
          }}></div>
          
          {/* Wood knots */}
          <div style={{
            position: 'absolute',
            top: '20%',
            right: '15%',
            width: '15px',
            height: '20px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #5C3317 0%, #3D2210 100%)',
            opacity: 0.7,
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
          }}></div>
          <div style={{
            position: 'absolute',
            bottom: '30%',
            left: '20%',
            width: '12px',
            height: '15px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #5C3317 0%, #3D2210 100%)',
            opacity: 0.6,
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
          }}></div>
          
          {/* Shine effect */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)',
            backgroundSize: '200% 100%',
            animation: 'shine 3s ease-in-out 1.5s infinite',
            pointerEvents: 'none'
          }}></div>
        </div>

        {/* Realistic Shelves with depth */}
        <div style={{
          position: 'absolute',
          width: '84%',
          height: '10px',
          left: '8%',
          top: '32%',
          background: `
            linear-gradient(180deg, 
              #A0522D 0%, 
              #8B4513 40%,
              #6B3410 100%
            )
          `,
          borderRadius: '2px',
          boxShadow: `
            0 4px 8px rgba(0,0,0,0.5),
            inset 0 -2px 4px rgba(0,0,0,0.4),
            inset 0 1px 2px rgba(160,82,45,0.5)
          `,
          animation: 'slideShelf 5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s infinite',
          opacity: 0,
          transform: 'translateX(-150%)',
          border: '1px solid #5C3317'
        }}>
          {/* Shelf edge highlight */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(205,133,63,0.5), transparent)',
            borderRadius: '2px 2px 0 0'
          }}></div>
        </div>
        
        <div style={{
          position: 'absolute',
          width: '84%',
          height: '10px',
          left: '8%',
          top: '62%',
          background: `
            linear-gradient(180deg, 
              #A0522D 0%, 
              #8B4513 40%,
              #6B3410 100%
            )
          `,
          borderRadius: '2px',
          boxShadow: `
            0 4px 8px rgba(0,0,0,0.5),
            inset 0 -2px 4px rgba(0,0,0,0.4),
            inset 0 1px 2px rgba(160,82,45,0.5)
          `,
          animation: 'slideShelf 5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s infinite',
          opacity: 0,
          transform: 'translateX(-150%)',
          border: '1px solid #5C3317'
        }}>
          {/* Shelf edge highlight */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(205,133,63,0.5), transparent)',
            borderRadius: '2px 2px 0 0'
          }}></div>
        </div>

        {/* Left Door - Ultra Realistic */}
        <div style={{
          position: 'absolute',
          width: '46%',
          height: '93%',
          left: '2%',
          top: '3.5%',
          background: `
            linear-gradient(135deg, 
              #CD853F 0%,
              #D2691E 25%,
              #C87533 50%,
              #B8651F 75%,
              #A0522D 100%
            )
          `,
          border: '4px solid #6B3410',
          borderRadius: '4px',
          transformOrigin: 'left center',
          transformStyle: 'preserve-3d',
          animation: 'swingDoor 5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s infinite',
          opacity: 0,
          boxShadow: `
            3px 0 12px rgba(0,0,0,0.5),
            inset -2px 0 8px rgba(0,0,0,0.3),
            inset 2px 2px 4px rgba(205,133,63,0.4)
          `
        }}>
          {/* Door panel frame (raised panel) */}
          <div style={{
            position: 'absolute',
            top: '8%',
            left: '8%',
            right: '8%',
            bottom: '8%',
            border: '3px solid #A0522D',
            borderRadius: '3px',
            boxShadow: `
              inset 0 2px 6px rgba(0,0,0,0.3),
              0 0 0 2px #8B4513,
              inset 0 -2px 4px rgba(205,133,63,0.3)
            `,
            background: 'linear-gradient(135deg, #D2691E 0%, #C87533 50%, #B8651F 100%)'
          }}>
            {/* Inner bevel */}
            <div style={{
              position: 'absolute',
              top: '5px',
              left: '5px',
              right: '5px',
              bottom: '5px',
              border: '1px solid rgba(139,69,19,0.5)',
              borderRadius: '2px'
            }}></div>
          </div>
          
          {/* Realistic metal handle */}
          <div style={{
            position: 'absolute',
            right: '12%',
            top: '48%',
            width: '10px',
            height: '35px',
            background: `
              linear-gradient(90deg, 
                #B8B8B8 0%,
                #E8E8E8 30%,
                #FFFFFF 50%,
                #E8E8E8 70%,
                #A8A8A8 100%
              )
            `,
            borderRadius: '5px',
            boxShadow: `
              -2px 0 4px rgba(0,0,0,0.4),
              inset 1px 0 2px rgba(255,255,255,0.8),
              inset -1px 0 2px rgba(0,0,0,0.3)
            `,
            border: '1px solid #888'
          }}>
            {/* Handle screws */}
            <div style={{
              position: 'absolute',
              top: '5px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '3px',
              height: '3px',
              borderRadius: '50%',
              background: '#666',
              boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.5)'
            }}></div>
            <div style={{
              position: 'absolute',
              bottom: '5px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '3px',
              height: '3px',
              borderRadius: '50%',
              background: '#666',
              boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.5)'
            }}></div>
          </div>
          
          {/* Wood grain on door */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `
              repeating-linear-gradient(
                90deg,
                transparent 0px,
                rgba(107, 52, 16, 0.1) 1px,
                transparent 2px,
                transparent 6px
              )
            `,
            opacity: 0.6,
            pointerEvents: 'none',
            borderRadius: '2px'
          }}></div>
        </div>

        {/* Right Door - Ultra Realistic */}
        <div style={{
          position: 'absolute',
          width: '46%',
          height: '93%',
          right: '2%',
          top: '3.5%',
          background: `
            linear-gradient(135deg, 
              #CD853F 0%,
              #D2691E 25%,
              #C87533 50%,
              #B8651F 75%,
              #A0522D 100%
            )
          `,
          border: '4px solid #6B3410',
          borderRadius: '4px',
          transformOrigin: 'right center',
          transformStyle: 'preserve-3d',
          animation: 'swingDoor 5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.6s infinite',
          opacity: 0,
          boxShadow: `
            -3px 0 12px rgba(0,0,0,0.5),
            inset 2px 0 8px rgba(0,0,0,0.3),
            inset -2px 2px 4px rgba(205,133,63,0.4)
          `
        }}>
          {/* Door panel frame (raised panel) */}
          <div style={{
            position: 'absolute',
            top: '8%',
            left: '8%',
            right: '8%',
            bottom: '8%',
            border: '3px solid #A0522D',
            borderRadius: '3px',
            boxShadow: `
              inset 0 2px 6px rgba(0,0,0,0.3),
              0 0 0 2px #8B4513,
              inset 0 -2px 4px rgba(205,133,63,0.3)
            `,
            background: 'linear-gradient(135deg, #D2691E 0%, #C87533 50%, #B8651F 100%)'
          }}>
            {/* Inner bevel */}
            <div style={{
              position: 'absolute',
              top: '5px',
              left: '5px',
              right: '5px',
              bottom: '5px',
              border: '1px solid rgba(139,69,19,0.5)',
              borderRadius: '2px'
            }}></div>
          </div>
          
          {/* Realistic metal handle */}
          <div style={{
            position: 'absolute',
            left: '12%',
            top: '48%',
            width: '10px',
            height: '35px',
            background: `
              linear-gradient(90deg, 
                #B8B8B8 0%,
                #E8E8E8 30%,
                #FFFFFF 50%,
                #E8E8E8 70%,
                #A8A8A8 100%
              )
            `,
            borderRadius: '5px',
            boxShadow: `
              2px 0 4px rgba(0,0,0,0.4),
              inset -1px 0 2px rgba(255,255,255,0.8),
              inset 1px 0 2px rgba(0,0,0,0.3)
            `,
            border: '1px solid #888'
          }}>
            {/* Handle screws */}
            <div style={{
              position: 'absolute',
              top: '5px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '3px',
              height: '3px',
              borderRadius: '50%',
              background: '#666',
              boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.5)'
            }}></div>
            <div style={{
              position: 'absolute',
              bottom: '5px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '3px',
              height: '3px',
              borderRadius: '50%',
              background: '#666',
              boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.5)'
            }}></div>
          </div>
          
          {/* Wood grain on door */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `
              repeating-linear-gradient(
                90deg,
                transparent 0px,
                rgba(107, 52, 16, 0.1) 1px,
                transparent 2px,
                transparent 6px
              )
            `,
            opacity: 0.6,
            pointerEvents: 'none',
            borderRadius: '2px'
          }}></div>
        </div>

        {/* Sawdust particles */}
        <div style={{
          position: 'absolute',
          bottom: '-30px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100px',
          height: '20px',
          pointerEvents: 'none'
        }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: '#D2691E',
              left: `${i * 12}px`,
              animation: `sawdust 2s ease-out ${0.5 + i * 0.2}s infinite`,
              opacity: 0
            }}></div>
          ))}
        </div>
      </div>

      {/* Loading Text */}
      <div role="status" style={{
        textAlign: 'center',
        animation: 'fadeIn 1s ease-out 0.5s backwards'
      }}>
        <p style={{
          color: '#fff',
          fontSize: '22px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          margin: '0 0 10px 0',
          fontWeight: 600,
          letterSpacing: '1px',
          textShadow: '0 2px 8px rgba(0,0,0,0.5)'
        }}>
          {LOADING_TEXT[lang]}
        </p>
        
        {/* Animated dots */}
        <div aria-hidden="true" style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '10px',
          marginTop: '18px'
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #464646ff 0%, rgba(110, 110, 110, 1) 100%)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            animation: 'bounce 1.4s ease-in-out 0s infinite'
          }}></div>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg,  #464646ff 0%, rgba(110, 110, 110, 1) 100%)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            animation: 'bounce 1.4s ease-in-out 0.2s infinite'
          }}></div>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg,  #464646ff 0%, rgba(110, 110, 110, 1) 100%)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            animation: 'bounce 1.4s ease-in-out 0.4s infinite'
          }}></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingAnimation;
