import os
from pathlib import Path

for root, dirs, files in os.walk('./cache'):
    for filename in files:
        path = os.path.join(root, filename)
        size = Path(path).stat().st_size
        if size == 0:
            print(path)
            os.remove(path)
        else:
            with open(path, 'r') as f:
                data = f.read(10)
                if not data.startswith('Rank'):
                    print(path)
                    os.remove(path)

