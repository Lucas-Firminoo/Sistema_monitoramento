// cyber-bg.js - Fundo animado futurista (Rede Neural / Malha L2)

(function initCyberBackground() {
    const canvas = document.getElementById('cyberCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let w, h, particles = [];
    
    // Mouse Interaction
    const mouse = { x: -1000, y: -1000, isActive: false };
    
    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.isActive = true;
    });
    
    window.addEventListener('mouseleave', () => {
        mouse.isActive = false;
        mouse.x = -1000;
        mouse.y = -1000;
    });

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }
    
    window.addEventListener('resize', resize);
    resize();

    // Criação inicial das partículas (densidade média para performance)
    for (let i = 0; i < 70; i++) {
        particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            radius: Math.random() * 1.5 + 0.5
        });
    }

    function draw() {
        ctx.clearRect(0, 0, w, h);
        
        // Base color for normal nodes
        ctx.fillStyle = 'rgba(5, 255, 145, 0.4)';

        particles.forEach((p, index) => {
            // Movimentação
            p.x += p.vx;
            p.y += p.vy;
            
            // Rebote nas bordas
            if (p.x < 0 || p.x > w) p.vx *= -1;
            if (p.y < 0 || p.y > h) p.vy *= -1;

            // Interação com o Mouse (Atração)
            if (mouse.isActive) {
                const dx = mouse.x - p.x;
                const dy = mouse.y - p.y;
                const distToMouse = Math.hypot(dx, dy);
                
                if (distToMouse < 200) {
                    // Puxa levemente em direção ao mouse
                    p.x += dx * 0.003;
                    p.y += dy * 0.003;
                    
                    // Desenha linha até o cursor
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(5, 255, 145, ${0.25 - (distToMouse/800)})`;
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.stroke();
                }
            }

            // Desenhar partícula (Nó)
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();

            // Desenhar linhas de conexão orgânicas entre nós
            for (let j = index + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
                if (dist < 120) {
                    ctx.beginPath();
                    // Gradiente de opacidade sutil
                    ctx.strokeStyle = `rgba(5, 255, 145, ${0.1 - (dist/1200)})`;
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            }
        });
        requestAnimationFrame(draw);
    }
    
    draw();
})();
