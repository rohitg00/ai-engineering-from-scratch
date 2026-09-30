"""Browser Agent screenshot verifier using the Python standard library.
See ../stages/03-visual-proof/docs/en.md for the RGB PNG subset.
Unfilter Chromium screenshot pixels and count green success pixels.
This is visual state evidence, not OCR or a general vision model.
"""
import json, struct, sys, zlib

def inspect(data):
    if len(data)>8_000_000 or not data.startswith(b'\x89PNG\r\n\x1a\n'): raise ValueError('invalid PNG')
    pos, compressed, header, ended = 8, bytearray(), None, False
    while pos < len(data):
        if pos+12>len(data): raise ValueError('truncated chunk')
        size=struct.unpack('>I',data[pos:pos+4])[0]; kind=data[pos+4:pos+8]; payload=data[pos+8:pos+8+size]
        if pos+12+size>len(data): raise ValueError('truncated payload')
        crc=struct.unpack('>I',data[pos+8+size:pos+12+size])[0]
        if zlib.crc32(kind+payload)&0xffffffff != crc: raise ValueError('CRC mismatch')
        if kind==b'IHDR':
            if header is not None or size!=13: raise ValueError('invalid header')
            header=struct.unpack('>IIBBBBB',payload)
        elif kind==b'IDAT': compressed.extend(payload)
        elif kind==b'IEND': ended=True; break
        pos+=12+size
    if not header or not ended: raise ValueError('incomplete PNG')
    width,height,depth,color,compression,filtering,interlace=header
    if not width or not height or width*height>10_000_000 or depth!=8 or color not in (2,6) or compression or filtering or interlace: raise ValueError('unsupported PNG')
    channels=3 if color==2 else 4; stride=width*channels; expected=(stride+1)*height
    decoder=zlib.decompressobj(); raw=decoder.decompress(bytes(compressed),expected+1)
    if len(raw)!=expected or not decoder.eof: raise ValueError('invalid pixel size')
    previous=bytearray(stride); green=0
    for y in range(height):
        offset=y*(stride+1); mode=raw[offset]; row=bytearray(raw[offset+1:offset+1+stride])
        if mode>4: raise ValueError('unknown filter')
        for x in range(stride):
            left=row[x-channels] if x>=channels else 0; up=previous[x]; corner=previous[x-channels] if x>=channels else 0
            if mode==1: prediction=left
            elif mode==2: prediction=up
            elif mode==3: prediction=(left+up)//2
            elif mode==4:
                p=left+up-corner; a,b,c=abs(p-left),abs(p-up),abs(p-corner)
                prediction=left if a<=b and a<=c else up if b<=c else corner
            else: prediction=0
            row[x]=(row[x]+prediction)&255
        for x in range(0,stride,channels):
            r,g,b=row[x:x+3]
            if g>110 and g>r*1.3 and g>b*1.15: green+=1
        previous=row
    return {'width':width,'height':height,'greenFraction':green/(width*height)}

if __name__=='__main__':
    try:
        with open(sys.argv[1],'rb') as stream: print(json.dumps(inspect(stream.read(8_000_001))))
    except (ValueError,zlib.error,struct.error) as error: print(str(error),file=sys.stderr);sys.exit(1)
