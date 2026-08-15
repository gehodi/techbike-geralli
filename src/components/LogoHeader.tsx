import { Document, Image } from '@react-pdf/renderer'

interface LogoHeaderProps {
  titulo: string
  subtitulo?: string
}

export const LogoHeader = ({ titulo, subtitulo }: LogoHeaderProps) => {
  return (
    <Document>
      {/* Encabezado con Logo */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 10,
        borderBottom: '2px solid #1e293b'
      }}>
        {/* Logo SPACE BIKE - Usando base64 o URL */}
        <Image 
          src="https://tu-dominio.com/logo-space-bike.png" 
          style={{ width: 200, height: 'auto', marginBottom: 10 }}
        />
        <div style={{ 
          fontSize: 18, 
          fontWeight: 'bold', 
          color: '#1e293b',
          textAlign: 'center',
          marginTop: 10
        }}>
          {titulo}
        </div>
        {subtitulo && (
          <div style={{ 
            fontSize: 10, 
            color: '#64748b',
            textAlign: 'center',
            marginTop: 5
          }}>
            {subtitulo}
          </div>
        )}
      </div>
    </Document>
  )
}