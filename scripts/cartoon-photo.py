"""Local photo-to-cartoon filter. Reads image bytes from stdin, emits PNG only."""
import io
import sys
import warnings
from PIL import Image, ImageOps, ImageFilter

Image.MAX_IMAGE_PIXELS = 16_000_000
warnings.simplefilter('error', Image.DecompressionBombWarning)


def cartoon(data):
    with Image.open(io.BytesIO(data)) as source:
        source.load()
        image = ImageOps.exif_transpose(source).convert('RGB')
    image = ImageOps.fit(image, (512, 512), method=Image.Resampling.LANCZOS)
    smooth = image.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.SMOOTH_MORE)
    colors = ImageOps.posterize(smooth, 4).quantize(colors=24).convert('RGB')
    gray = smooth.convert('L')
    edges = gray.filter(ImageFilter.FIND_EDGES)
    edges = edges.point(lambda v: 35 if v > 35 else 255)
    # FIND_EDGES treats the image border as an edge: remove that artifact.
    edges.paste(255, (0, 0, 512, 2))
    edges.paste(255, (0, 510, 512, 512))
    edges.paste(255, (0, 0, 2, 512))
    edges.paste(255, (510, 0, 512, 512))
    from PIL import ImageChops
    output = ImageChops.multiply(colors, edges.convert('RGB'))
    result = io.BytesIO()
    output.save(result, format='PNG', optimize=True)
    return result.getvalue()


if __name__ == '__main__':
    try:
        data = sys.stdin.buffer.read(2 * 1024 * 1024 + 1)
        if not data or len(data) > 2 * 1024 * 1024:
            raise ValueError('Invalid image size')
        sys.stdout.buffer.write(cartoon(data))
    except Exception:
        print('Unable to process profile photo', file=sys.stderr)
        sys.exit(1)
