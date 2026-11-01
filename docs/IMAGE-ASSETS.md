# Изображения версии 3

Созданы встроенным ImageGen, не через API/CLI. Исходные PNG сохранены в локальной папке asset-originals; оптимизированные изображения — public/assets/photos и pages/assets/photos.

Общий prompt: «Use case: product-mockup. Single photorealistic car rental catalog photograph for a dark premium automotive website. Whole car visible, front-left three-quarter view, 3:2 landscape composition, dark charcoal studio, subtle teal reflections and amber rim light, realistic glass, paint and tires, no people, no text, no watermark, no readable plates».

- **solaris.webp:** silver metallic 2021 Hyundai Solaris sedan; фотостудия графитового цвета, ракурс спереди слева, весь автомобиль в кадре, мягкий бирюзовый отражённый свет и янтарная контровая подсветка, без людей, текста, водяных знаков и читаемых номеров.
- **rio.webp:** deep cherry red 2021 Kia Rio sedan; фотостудия графитового цвета, ракурс спереди слева, весь автомобиль в кадре, мягкий бирюзовый отражённый свет и янтарная контровая подсветка, без людей, текста, водяных знаков и читаемых номеров.
- **polo.webp:** slate blue 2022 Volkswagen Polo liftback; фотостудия графитового цвета, ракурс спереди слева, весь автомобиль в кадре, мягкий бирюзовый отражённый свет и янтарная контровая подсветка, без людей, текста, водяных знаков и читаемых номеров.
- **creta.webp:** graphite metallic 2022 Hyundai Creta compact SUV; фотостудия графитового цвета, ракурс спереди слева, весь автомобиль в кадре, мягкий бирюзовый отражённый свет и янтарная контровая подсветка, без людей, текста, водяных знаков и читаемых номеров.
- **octavia.webp:** pearl white 2021 Skoda Octavia liftback; фотостудия графитового цвета, ракурс спереди слева, весь автомобиль в кадре, мягкий бирюзовый отражённый свет и янтарная контровая подсветка, без людей, текста, водяных знаков и читаемых номеров.
- **camry.webp:** black metallic 2022 Toyota Camry sedan; фотостудия графитового цвета, ракурс спереди слева, весь автомобиль в кадре, мягкий бирюзовый отражённый свет и янтарная контровая подсветка, без людей, текста, водяных знаков и читаемых номеров.
- **x3.webp:** dark emerald green 2022 BMW X3 SUV; фотостудия графитового цвета, ракурс спереди слева, весь автомобиль в кадре, мягкий бирюзовый отражённый свет и янтарная контровая подсветка, без людей, текста, водяных знаков и читаемых номеров.
- **c200.webp:** champagne silver 2021 Mercedes-Benz C-Class C200 sedan; фотостудия графитового цвета, ракурс спереди слева, весь автомобиль в кадре, мягкий бирюзовый отражённый свет и янтарная контровая подсветка, без людей, текста, водяных знаков и читаемых номеров.

Hero prompt: «Dark emerald BMW X3 on a quiet Baltic coastal road at blue-hour dusk, sea and pine forest, subtle amber horizon, car on the right half, dark negative space on the left, physically realistic automotive photography, no UI, people, text or watermarks».

PNG сохранены без изменений. Производственные WebP получены механическим уменьшением и сжатием через Pillow: 800 px для автомобилей, 1600 px для обложки, 900 px для мобильной обложки; quality 83. Это иллюстрации, созданные с ИИ, а не фотографии реального автопарка. Такое пояснение есть на сайте.

Суммарный размер WebP — около 550 КБ. На первом экране загружается одна версия обложки; изображения карточек используют loading=lazy и decoding=async.
