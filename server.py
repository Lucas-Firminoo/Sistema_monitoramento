import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Permite acesso do frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/ping")
async def ping_endpoint(request: Request, ip: str, count: str = "4"):
    async def event_generator():
        try:
            if count.lower() in ['continuous', '-t']:
                # Ping contínuo no Windows
                cmd = ["ping", "-t", ip]
            else:
                # Ping normal no Windows
                num = int(count) if count.isdigit() else 4
                cmd = ["ping", "-n", str(num), ip]

            # Inicia o processo de ping de forma assíncrona
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT
            )

            # Lê linha por linha conforme o comando vai gerando saída
            while True:
                # Se o frontend fechar a conexão (apertar "Parar" e fechar EventSource)
                if await request.is_disconnected():
                    process.terminate()
                    break

                line = await process.stdout.readline()
                if not line:
                    break

                # No Windows pt-BR, o ping geralmente usa a codificação 'cp850' ou 'iso-8859-1' no console
                decoded_line = line.decode('cp850', errors='replace').strip()
                if decoded_line:
                    yield f"data: {decoded_line}\n\n"

            # Quando terminar (se for count normal)
            if process.returncode is None:
                process.terminate()
                
            yield f"data: [DONE]\n\n"
        except Exception as e:
            yield f"data: Error: {str(e)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5555)
