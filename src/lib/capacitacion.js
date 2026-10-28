// Archivo: src/lib/capacitacion.js
// Contenido del módulo de Capacitación (manual de ventas de Mr. Chester).
// Cada lección tiene bloques de contenido y un quiz. Para cambiar un texto, edítalo aquí.
// Tipos de bloque: p (párrafo), lista, tip (recuadro dorado), guion (lo que dice el vendedor),
// tabla, precios (lista de precios en vivo desde Productos), alerta (recuadro rojo).

export const APROBAR = 0.8 // 80% de respuestas correctas para aprobar

export const MODULOS = [
  {
    id: 'm1', titulo: 'Bienvenida a Mr. Chester', icono: '♛',
    lecciones: [
      {
        id: 'quienes-somos', titulo: 'Quiénes somos', minutos: 5,
        bloques: [
          { t: 'p', x: 'Mr. Chester es fabricante directo de sofás Chesterfield en Bogotá. No somos una mueblería que vende de todo: nos especializamos prácticamente en un solo producto, y eso nos permite ser los mejores en él.' },
          { t: 'tip', x: 'Es mejor ser los mejores en una cosa que uno más del montón en muchas.' },
          { t: 'lista', titulo: 'Lo que nos hace diferentes', items: [
            'Somos fabricantes: el sofá se hace en nuestra propia fábrica, sin intermediarios. Por eso el precio es mucho más bajo que el de una mueblería con la misma calidad.',
            'Somos especialistas en Chesterfield: es lo que sabemos hacer y lo hacemos todos los días.',
            'Llevamos más de 8.000 sofás vendidos, y muchos artistas y personajes reconocidos tienen un Mr. Chester.',
            'Somos la empresa #1 en sofás Chesterfield en Colombia.',
            'Todos nuestros insumos están certificados y damos 5 años de garantía, algo que casi nadie ofrece.',
          ] },
          { t: 'p', x: 'Nuestro trabajo como asesores es que cada cliente entienda esto y se sienta seguro de que está comprando un mueble para muchos años, hecho por quienes más saben de Chesterfield en el país.' },
        ],
        quiz: [
          { p: '¿Por qué Mr. Chester puede tener mejor precio que una mueblería?', o: ['Porque usa materiales más baratos', 'Porque es fabricante directo, sin intermediarios', 'Porque siempre está en promoción'], c: 1, e: 'Somos fabricantes: el sofá sale de nuestra fábrica directo al cliente.' },
          { p: '¿Cuántos sofás ha vendido Mr. Chester?', o: ['Más de 800', 'Más de 8.000', 'Más de 80.000'], c: 1, e: 'Más de 8.000 sofás vendidos. Es un argumento de confianza muy fuerte.' },
          { p: '¿Cuántos años de garantía tienen nuestros productos?', o: ['1 año', '3 años', '5 años'], c: 2, e: '5 años de garantía: casi nadie en el mercado la ofrece.' },
          { p: '¿Cuál es nuestra gran diferencia frente a las mueblerías?', o: ['Vendemos todo tipo de muebles', 'Nos especializamos en sofás Chesterfield y los fabricamos', 'Solo vendemos por internet'], c: 1, e: 'Especialistas y fabricantes: esa es la frase clave.' },
        ],
      },
      {
        id: 'historia', titulo: 'La historia del Chesterfield', minutos: 5,
        bloques: [
          { t: 'p', x: 'El Chesterfield es uno de los sofás más famosos y copiados de la historia. Nació en Inglaterra en el siglo XVIII y hoy, más de 250 años después, sigue siendo un clásico que nunca pasa de moda.' },
          { t: 'p', x: 'Cuenta la historia que Philip Stanhope, cuarto Conde de Chesterfield, pidió un sofá en el que los caballeros pudieran sentarse derechos y elegantes sin arrugar sus trajes. De ahí salió su forma tan reconocible: brazos enrollados a la misma altura del respaldo, capitoneado profundo hecho a mano y taches que rematan el borde.' },
          { t: 'p', x: 'En la época victoriana se volvió el sofá de los clubes de caballeros de Londres, las bibliotecas y los despachos. Por eso hasta hoy transmite elegancia, autoridad y carácter, y por eso lo eligen oficinas de abogados, barberías, estudios de tatuaje y casas con estilo.' },
          { t: 'tip', x: 'Cuéntale la historia al cliente en 30 segundos: a la gente le encanta saber que su sofá tiene más de 250 años de tradición inglesa.' },
          { t: 'p', x: 'El Chester Cheers es nuestra versión del clásico inglés: el Chesterfield de toda la vida, con brazos redondos, capitoneado en el respaldo y taches en bronce envejecido.' },
        ],
        quiz: [
          { p: '¿De dónde viene el sofá Chesterfield?', o: ['Italia', 'Inglaterra', 'Estados Unidos'], c: 1, e: 'Nació en Inglaterra en el siglo XVIII.' },
          { p: 'Según la historia, ¿para qué se diseñó?', o: ['Para dormir siesta', 'Para que los caballeros se sentaran derechos sin arrugar su ropa', 'Para salas pequeñas'], c: 1, e: 'Por eso los brazos van a la misma altura del respaldo y la postura es derecha.' },
          { p: '¿Cuál de nuestros modelos es el clásico inglés?', o: ['Bentley', 'Texas', 'Chester Cheers'], c: 2, e: 'El Cheers es el Chesterfield clásico: brazos redondos, capitoneado y taches.' },
        ],
      },
    ],
  },
  {
    id: 'm2', titulo: 'Conoce el producto', icono: '🛋️',
    lecciones: [
      {
        id: 'fabricacion', titulo: 'Cómo se fabrica un Mr. Chester', minutos: 8,
        bloques: [
          { t: 'p', x: 'Un cliente compra con confianza cuando entiende lo que hay por dentro. Explícalo así, de adentro hacia afuera:' },
          { t: 'lista', titulo: '1. Estructura: madera pino 100% seca e inmunizada', items: [
            'Seca: la madera se seca antes de trabajarla para quitarle la humedad. Una madera húmeda se tuerce, se raja y hace que el sofá cruja con el tiempo. La madera seca se queda estable por años.',
            'Inmunizada: recibe un tratamiento que la protege del gorgojo, el comején y los hongos. Así la estructura no se daña por plagas ni por humedad.',
            'Pino: es una madera resistente y a la vez liviana, que sostiene muy bien las grapas y los tornillos. Por eso el sofá es firme pero se puede mover sin problema.',
          ] },
          { t: 'lista', titulo: '2. Espuma de alta densidad (densidad 26)', items: [
            'La densidad indica cuánto material tiene la espuma. A mayor densidad, más dura, más soporte y menos se hunde con el uso.',
            'La espuma de densidad 26 recupera su forma después de cada uso. Por eso la garantía cubre el hundimiento de las espumas: confiamos en ella.',
            'Usamos varias capas de espuma para que el asiento sea firme y cómodo a la vez, con la postura derecha típica del Chesterfield.',
          ] },
          { t: 'lista', titulo: '3. Capitoneado a mano, técnica inglesa', items: [
            'El capitoneado se hace a mano, doblando y anclando el material uno por uno, como se hace en Inglaterra. No es una costura que imita el capitoneado.',
            'Por eso cada pliegue queda profundo y definido, y no se deforma con el tiempo.',
          ] },
          { t: 'lista', titulo: '4. Taches en bronce envejecido', items: [
            'Cada tache se pone a mano, uno por uno, siguiendo el borde del sofá.',
            'El bronce envejecido le da el toque clásico y elegante del Chesterfield original.',
          ] },
          { t: 'lista', titulo: '5. Insumos certificados y garantía', items: [
            'Todos nuestros insumos están certificados.',
            '5 años de garantía en estructura, espumas y tela.',
          ] },
          { t: 'guion', x: '"Este sofá no es de los que a los dos años se hunden o crujen. La madera es pino seco e inmunizado, la espuma es de alta densidad, el capitoneado es a mano como en Inglaterra, y por eso le damos 5 años de garantía."' },
        ],
        quiz: [
          { p: '¿Por qué es importante que la madera esté seca?', o: ['Para que pese más', 'Para que no se tuerza, no se raje ni cruja', 'Para que sea más barata'], c: 1, e: 'La humedad hace que la madera se mueva. Seca, se queda estable por años.' },
          { p: '¿Qué hace el inmunizado?', o: ['Le da color a la madera', 'La protege de gorgojo, comején y hongos', 'La hace más blanda'], c: 1, e: 'Protege la estructura de plagas y humedad.' },
          { p: '¿Qué densidad tiene nuestra espuma?', o: ['Densidad 18', 'Densidad 22', 'Densidad 26'], c: 2, e: 'Densidad 26, alta densidad: no se hunde y recupera su forma.' },
          { p: '¿Cómo se hace nuestro capitoneado?', o: ['Con una costura que lo imita', 'A mano, con la técnica inglesa', 'Con máquina'], c: 1, e: 'A mano, sin costura, tal como se hace en Inglaterra.' },
          { p: '¿De qué material son los taches?', o: ['Plástico dorado', 'Bronce envejecido', 'Aluminio'], c: 1, e: 'Taches en bronce envejecido, puestos uno por uno.' },
        ],
      },
      {
        id: 'cuero-vegano', titulo: 'Cuero vegano y telas', minutos: 8,
        bloques: [
          { t: 'alerta', x: 'La pregunta que más nos hacen: "¿Eso es cuero animal?" Esta lección es la más importante para cerrar ventas.' },
          { t: 'p', x: 'La mayoría de nuestros sofás se hacen en cuero vegano. Es un material que se ve y se siente como cuero, pero no viene de ningún animal. Cuando el cliente pregunta, la respuesta es honesta y segura: "Es cuero vegano, y te explico por qué es la mejor opción para este sofá."' },
          { t: 'lista', titulo: 'Beneficios del cuero vegano frente al cuero animal', items: [
            'No necesita hidratación: el cuero animal hay que hidratarlo con cremas o se reseca y se agrieta. El cuero vegano no.',
            'Limpieza muy fácil: basta un trapito húmedo. No absorbe los líquidos como el cuero animal, así que una mancha de café o vino se limpia rápido.',
            'Color parejo: todo el sofá queda del mismo tono, sin las marcas y diferencias propias de la piel animal.',
            'Mejor precio: un Chesterfield en cuero animal cuesta varias veces más.',
            'Ningún animal: para muchos clientes esto es importante.',
            'Garantía: la garantía de 5 años cubre grietas, decoloración y peladuras de la tela.',
          ] },
          { t: 'p', x: 'La gran objeción: "el cuero vegano se pela". La gente lo dice porque lo compara con la cuerina barata: un plástico delgado que en poco tiempo se agrieta y se pela. Nuestro cuero vegano no es eso. Es un material de alta calidad, con una base textil resistente, pensado para un sofá que se usa todos los días.' },
          { t: 'guion', x: '"Te entiendo, muchos clientes han tenido una mala experiencia con cuerina barata. Este no es ese material. Y para que estés tranquilo: si se pela, se agrieta o se decolora, la garantía te cubre 5 años. Nadie te da eso con una cuerina."' },
          { t: 'tip', x: 'Deja que el cliente toque el material y compáralo con la mano: grosor, textura y suavidad. Tocarlo convence más que cualquier explicación.' },
          { t: 'lista', titulo: 'Otras telas', items: [
            'Terciopelo con protección antifluidos: elegante, suave y fácil de limpiar.',
            'Lona tipo lino: con protección antifluidos; es la del Manchester, de look natural y moderno.',
          ] },
          { t: 'lista', titulo: 'Cuidados', items: [
            'Limpiar solo con un trapito húmedo. Entre menos, mejor.',
            'No usar químicos, alcohol, cloro ni productos para cuero animal.',
            'Evitar el sol directo por muchas horas y los objetos cortopunzantes.',
          ] },
          { t: 'alerta', x: 'Nunca digas que es cuero animal ni lo dejes en duda. La confianza del cliente vale más que una venta.' },
        ],
        quiz: [
          { p: 'Un cliente pregunta: "¿Es cuero animal?" ¿Qué respondes?', o: ['"Sí, más o menos"', '"Es cuero vegano, y te explico por qué es la mejor opción"', '"No sé, creo que sí"'], c: 1, e: 'Siempre la verdad, con seguridad, y de una vez explicas los beneficios.' },
          { p: '¿Qué necesita el cuero animal que el cuero vegano no?', o: ['Hidratación con cremas', 'Limpieza con trapo', 'Taches'], c: 0, e: 'El cuero animal se reseca y agrieta si no se hidrata.' },
          { p: 'El cliente dice: "El cuero vegano se pela." ¿Cuál es tu mejor argumento?', o: ['"No sé, puede ser"', '"Ese es el problema de la cuerina barata; además la garantía de 5 años cubre peladuras"', '"Entonces mejor llévelo en tela"'], c: 1, e: 'Diferencia del material barato + garantía de 5 años.' },
          { p: '¿Cómo se limpia un sofá Mr. Chester?', o: ['Con alcohol', 'Con crema para cuero', 'Con un trapito húmedo'], c: 2, e: 'Trapito húmedo. Entre menos, mejor.' },
          { p: '¿Qué telas tienen protección antifluidos?', o: ['Terciopelo y lona tipo lino', 'Ninguna', 'Solo el cuero animal'], c: 0, e: 'Terciopelo y lona tipo lino tienen protección antifluidos.' },
        ],
      },
      {
        id: 'modelos', titulo: 'Nuestros modelos y medidas', minutos: 6,
        bloques: [
          { t: 'p', x: 'Todos los modelos comparten la misma calidad de fabricación. Lo que cambia es el estilo.' },
          { t: 'tabla', cols: ['Modelo', 'Qué lo hace especial'], filas: [
            ['Chester Cheers', 'El clásico inglés: brazos redondos, respaldo capitoneado y taches. Es el más vendido (cerca del 80% de las ventas).'],
            ['Beckham', 'Igual al Cheers, pero con los taches en forma cuadrada.'],
            ['Manchester', 'Como el Cheers pero sin taches, en lona tipo lino. Look más natural.'],
            ['Picadilly', 'Además del respaldo, tiene el asiento capitoneado. El más elegante.'],
            ['Bentley', 'La versión moderna del Chester: brazos rectos en vez de redondos, sin taches y patas cónicas.'],
            ['Texas', 'Sin capitoneado. Para quien quiere la silueta Chester más limpia.'],
          ] },
          { t: 'tabla', cols: ['Medida', 'Valor'], filas: [
            ['Largos', '1,80 · 2,00 · 2,20 · 2,40 m (Cheers hasta 2,60 m)'],
            ['Fondo', '90 cm en todos los modelos'],
            ['Altura del piso al asiento', '45 cm'],
            ['Altura total', 'unos 75 cm'],
          ] },
          { t: 'p', x: 'También fabricamos poltronas, esquineros y puffs. El largo se puede hacer a la medida (solo el largo): cambia el precio y se cotiza según la medida.' },
          { t: 'tip', x: 'Pídele al cliente la medida de la pared o del espacio. Así le recomiendas el largo correcto y no se equivoca.' },
        ],
        quiz: [
          { p: '¿Qué modelo no tiene taches y es de lona tipo lino?', o: ['Manchester', 'Beckham', 'Cheers'], c: 0, e: 'El Manchester es como el Cheers pero sin taches.' },
          { p: '¿Qué tiene de especial el Picadilly?', o: ['No tiene brazos', 'El asiento también es capitoneado', 'Es más pequeño'], c: 1, e: 'El Picadilly tiene el asiento capitoneado.' },
          { p: '¿Cuál es la versión moderna, con brazos rectos?', o: ['Texas', 'Bentley', 'Cheers'], c: 1, e: 'El Bentley no tiene los brazos redondos.' },
          { p: '¿Cuánto mide el fondo de nuestros sofás?', o: ['80 cm', '90 cm', '1 metro'], c: 1, e: 'Todos tienen 90 cm de fondo.' },
          { p: '¿Qué medida se puede hacer personalizada?', o: ['Solo el largo', 'El fondo y el alto', 'Todas'], c: 0, e: 'Solo el largo, y se cotiza según la medida.' },
        ],
      },
      {
        id: 'precios', titulo: 'Lista de precios', minutos: 3,
        bloques: [
          { t: 'p', x: 'Esta lista sale directo del ERP, así que siempre está actualizada. El precio oferta es el de la promoción vigente.' },
          { t: 'precios' },
          { t: 'alerta', x: 'El vendedor no puede dar más descuento que el de la promoción. Si un cliente pide más, explica el valor del producto (fábrica, materiales, garantía) en vez de bajar el precio.' },
        ],
        quiz: [
          { p: 'Un cliente pide un descuento adicional a la promoción. ¿Qué haces?', o: ['Le doy 10% más para no perderlo', 'Le explico el valor del producto; no puedo dar más descuento que el de la promoción', 'Le digo que vuelva mañana'], c: 1, e: 'El descuento máximo es el de la promoción. Se vende valor, no precio.' },
          { p: '¿De dónde sale la lista de precios de la capacitación?', o: ['De un PDF viejo', 'Del ERP, siempre actualizada', 'De Instagram'], c: 1, e: 'Sale del ERP, así que siempre está al día.' },
        ],
      },
    ],
  },
  {
    id: 'm3', titulo: 'Políticas comerciales', icono: '📋',
    lecciones: [
      {
        id: 'politicas', titulo: 'Pagos, entregas y garantía', minutos: 6,
        bloques: [
          { t: 'tabla', cols: ['Tema', 'Política'], filas: [
            ['Abono', 'Para separar el pedido se paga la mitad (50%).'],
            ['Saldo', 'Se paga antes de despachar.'],
            ['Medios de pago', 'Transferencia Bancolombia, llave, Nequi y link de pago para tarjeta (sin cobro adicional).'],
            ['Tiempo de entrega', 'Según la programación de la fábrica. El ERP calcula la fecha con el primer cupo libre.'],
            ['Domicilio Bogotá', '$120.000 por sofá. Todas las entregas tienen costo.'],
            ['Fuera de Bogotá', 'Se cotiza según el destino.'],
            ['Garantía', '5 años: estructura, hundimiento de espumas y daños en la tela (grietas, decoloración y peladuras). No cubre mal uso.'],
            ['Devoluciones', 'No hay devoluciones después de 48 horas.'],
            ['Cambio de tela', 'Se puede cambiar máximo en un plazo de 15 días.'],
            ['Descuentos', 'Ninguno adicional al de la promoción vigente.'],
            ['Medidas especiales', 'Solo el largo del sofá. Cambia el precio y se cotiza.'],
          ] },
          { t: 'tip', x: 'Di las políticas con seguridad y desde el principio: abono, saldo antes de despachar y costo del domicilio. Así no hay sorpresas al final.' },
          { t: 'guion', x: '"Para separarlo pagas el 50%, y el saldo antes de que te lo despachemos. Puedes pagar por transferencia, Nequi o con tarjeta por link, sin recargo."' },
        ],
        quiz: [
          { p: '¿Cuánto se paga para separar un pedido?', o: ['El 30%', 'El 50%', 'El 100%'], c: 1, e: 'La mitad del valor.' },
          { p: '¿Cuándo se paga el saldo?', o: ['Contra entrega', 'Antes de despachar', 'Un mes después'], c: 1, e: 'El saldo se paga antes de despachar.' },
          { p: '¿Cuánto cuesta el domicilio de un sofá en Bogotá?', o: ['Es gratis', '$120.000', '$50.000'], c: 1, e: '$120.000 por sofá dentro de Bogotá.' },
          { p: '¿Qué NO cubre la garantía?', o: ['El hundimiento de las espumas', 'Las peladuras de la tela', 'El mal uso'], c: 2, e: 'La garantía no cubre mal uso.' },
          { p: '¿Hasta cuándo se puede cambiar la tela?', o: ['Máximo 15 días', 'Hasta el despacho', 'No se puede cambiar'], c: 0, e: 'Máximo en un plazo de 15 días.' },
          { p: '¿El link de pago con tarjeta tiene recargo?', o: ['Sí, 5%', 'No, no tiene cobro adicional', 'Depende del banco'], c: 1, e: 'Los links de pago no tienen cobro adicional.' },
        ],
      },
    ],
  },
  {
    id: 'm4', titulo: 'El arte de vender', icono: '🤝',
    lecciones: [
      {
        id: 'clientes', titulo: 'Conoce a nuestros clientes', minutos: 5,
        bloques: [
          { t: 'p', x: 'Lo más importante para vender es entender qué está buscando el cliente. Cada perfil valora cosas distintas:' },
          { t: 'tabla', cols: ['Perfil', 'Qué busca', 'Qué resaltar'], filas: [
            ['Joven urbano', 'Tendencia, estilo urbano o industrial', 'Diseño, personalidad, colores, cómo se ve en su espacio'],
            ['Abogados y oficinas', 'Elegancia, imagen seria, durabilidad', 'Historia del Chesterfield, calidad, garantía, factura'],
            ['Barberías', 'Un mueble que aguante uso diario y se vea espectacular', 'Resistencia, fácil limpieza, garantía de 5 años'],
            ['Tatuadores, moteros, rockeros', 'Carácter, estilo de vida', 'El Chester como ícono, taches, cuero, actitud'],
            ['Señoras de gusto clásico', 'Un mueble tradicional y elegante, no moderno', 'Tradición inglesa, acabados a mano, comodidad'],
          ] },
          { t: 'tip', x: 'En ventas institucionales (barberías, oficinas) lo que más pesa es que el mueble no les dé problemas: calidad, uso diario y una garantía que no da nadie.' },
        ],
        quiz: [
          { p: 'Para una barbería, ¿qué es lo más importante resaltar?', o: ['Que es el más barato', 'Resistencia al uso diario, fácil limpieza y garantía de 5 años', 'Que viene en muchos colores'], c: 1, e: 'En ventas institucionales manda la calidad y la garantía.' },
          { p: '¿Qué es lo más importante para vender?', o: ['Hablar mucho del precio', 'Entender qué está buscando el cliente', 'Mostrar todos los modelos'], c: 1, e: 'La asesoría empieza por entender al cliente.' },
          { p: 'A un abogado que busca un sofá para su oficina le hablarías de…', o: ['Elegancia, historia del Chesterfield y garantía', 'Que es tendencia en TikTok', 'Que es para dormir'], c: 0, e: 'Imagen seria, tradición y durabilidad.' },
        ],
      },
      {
        id: 'proceso', titulo: 'El proceso de venta paso a paso', minutos: 10,
        bloques: [
          { t: 'lista', titulo: '1. Recibir', items: [
            'Saluda con una sonrisa en los primeros segundos. En la tienda, levántate y acércate; en WhatsApp, responde rápido.',
            'Preséntate por tu nombre y pregunta el del cliente. Úsalo durante la conversación.',
          ] },
          { t: 'guion', x: '"¡Hola, bienvenido a Mr. Chester! Soy [tu nombre]. ¿Con quién tengo el gusto? Siéntate con confianza, estos sofás son para probarlos."' },
          { t: 'lista', titulo: '2. Entender (preguntar antes de ofrecer)', items: [
            '¿Para qué espacio es: casa, oficina, barbería, estudio?',
            '¿Cuánto mide el espacio o la pared?',
            '¿Qué estilo tiene el lugar? ¿Tienes una foto?',
            '¿Quiénes lo van a usar? ¿Hay niños o mascotas?',
            '¿Para cuándo lo necesitas?',
          ] },
          { t: 'lista', titulo: '3. Presentar', items: [
            'Recomienda uno o dos modelos según lo que entendiste. No muestres todo el catálogo.',
            'Haz que se siente y toque el material. Explica la fabricación de adentro hacia afuera.',
            'Cuenta la historia del Chesterfield y quiénes somos: especialistas, fabricantes, más de 8.000 sofás vendidos.',
          ] },
          { t: 'lista', titulo: '4. Resolver dudas y objeciones', items: [
            'Escucha la objeción completa, sin interrumpir.',
            'Dale la razón a la preocupación ("te entiendo") y responde con hechos.',
            'Mira la lección "Objeciones" para las respuestas a cada caso.',
          ] },
          { t: 'lista', titulo: '5. Cerrar', items: [
            'Cuando el cliente ya está convencido, propón el siguiente paso: "¿Te lo separo con el 50%?"',
            'Confirma modelo, medida, tela, dirección y fecha de entrega.',
            'Usa la urgencia real: la programación de la fábrica se llena; separar asegura su cupo.',
          ] },
          { t: 'lista', titulo: '6. Venta adicional', items: [
            'Ofrece poltrona, puff o esquinero para completar el espacio. Es muy importante.',
            'Una sala completa (sofá + poltrona) se ve mucho mejor y el cliente lo agradece.',
          ] },
          { t: 'guion', x: '"Con este sofá te queda espectacular una poltrona Cheers en la esquina. ¿Te muestro cómo se ven juntos?"' },
          { t: 'lista', titulo: '7. Seguimiento', items: [
            'Esto no es una venta de impulso: muchos clientes compran después de pensarlo.',
            'Si no compra hoy, pide su WhatsApp y escríbele. Una buena guía: al día siguiente, a los 3 días, a la semana y a los 15 días.',
            'Cada mensaje debe aportar algo: una foto de un sofá entregado, un video de la fábrica, la promoción o la fecha de entrega disponible.',
            'Registra cada prospecto en el CRM del ERP.',
          ] },
        ],
        quiz: [
          { p: '¿Qué haces antes de recomendar un modelo?', o: ['Mostrar todo el catálogo', 'Preguntar para qué espacio es, la medida y el estilo', 'Decir el precio'], c: 1, e: 'Primero entender, después ofrecer.' },
          { p: '¿Por qué es clave que el cliente se siente y toque el sofá?', o: ['Porque así se cansa', 'Porque sentir la calidad convence más que cualquier explicación', 'No es importante'], c: 1, e: 'Sentarse y tocar el material es lo que más convence.' },
          { p: 'El cliente no compró hoy. ¿Qué haces?', o: ['Nada, si quiere vuelve', 'Pido su WhatsApp y le hago seguimiento aportando algo en cada mensaje', 'Lo llamo todos los días'], c: 1, e: 'El seguimiento es muy importante, siempre aportando valor.' },
          { p: '¿Qué ofreces después de cerrar el sofá?', o: ['Nada más', 'Poltrona, puff o esquinero para completar el espacio', 'Otro sofá igual'], c: 1, e: 'La venta adicional es muy importante.' },
          { p: '¿Cómo cierras la venta?', o: ['"¿Te lo separo con el 50%?"', '"Piénsalo y me cuentas"', '"Es caro, ¿no?"'], c: 0, e: 'Propón el siguiente paso de forma natural.' },
        ],
      },
      {
        id: 'objeciones', titulo: 'Objeciones y cómo responderlas', minutos: 8,
        bloques: [
          { t: 'p', x: 'Una objeción no es un "no": es una duda que el cliente necesita resolver para comprar. Escucha, dale la razón a la preocupación y responde con hechos.' },
          { t: 'lista', titulo: '"¿Eso es cuero animal?"', items: ['Responde con seguridad que es cuero vegano y explica sus beneficios (ver la lección Cuero vegano).'] },
          { t: 'guion', x: '"Es cuero vegano, y es la mejor opción para este sofá: no se reseca ni se agrieta como el cuero animal, se limpia con un trapito húmedo y tiene 5 años de garantía."' },
          { t: 'lista', titulo: '"El cuero vegano se pela"', items: ['Diferencia nuestro material de la cuerina barata y usa la garantía.'] },
          { t: 'guion', x: '"Lo que se pela es la cuerina barata, que es un plástico delgado. Este es otro material. Y si se pela, la garantía te cubre 5 años."' },
          { t: 'lista', titulo: '"Se demora mucho la entrega"', items: ['Es un proceso artesanal y hecho a la medida. Además, la espera es señal de que se vende mucho, y a la gente le gusta comprar donde hay mucha venta.'] },
          { t: 'guion', x: '"Cada sofá se hace a mano para ti, no está guardado en una bodega. Gracias a Dios tenemos mucha demanda, por eso trabajamos con programación. Si lo separas hoy, te aseguro el cupo para el [fecha]."' },
          { t: 'lista', titulo: '"Lo consulto con mi esposa / mi pareja"', items: ['Es normal: es una decisión importante. Facilítale la consulta en vez de soltarlo.'] },
          { t: 'guion', x: '"¡Claro! ¿Te mando fotos y el video de este modelo para que se lo muestres? Si quieren, vengan juntos a la tienda a sentarse. ¿Les queda bien el sábado?"' },
          { t: 'lista', titulo: '"Lo quiero ver en persona"', items: ['¡Perfecto! Invítalo a la tienda con día y hora.'] },
          { t: 'guion', x: '"Te esperamos en la tienda de la 85 (Cra. 19A # 85-69), de lunes a sábado de 11 a.m. a 6 p.m. ¿Qué día te queda mejor para dejarte todo listo?"' },
          { t: 'lista', titulo: '"Está caro"', items: ['No bajes el precio: explica el valor. Somos fabricantes, por eso el precio ya está por debajo del mercado, con materiales certificados y 5 años de garantía.'] },
          { t: 'guion', x: '"Te entiendo. Piensa que es un sofá para muchos años: madera seca e inmunizada, espuma de alta densidad, capitoneado a mano y 5 años de garantía. Como somos fabricantes, en una mueblería un sofá así te cuesta mucho más."' },
        ],
        quiz: [
          { p: 'El cliente dice "lo consulto con mi esposa". ¿Qué es lo mejor?', o: ['"Bueno, cualquier cosa me escribe"', 'Ofrecerle fotos y video para mostrarle e invitarlos a venir juntos', 'Bajarle el precio para que decida ya'], c: 1, e: 'Facilita la consulta y propón un siguiente paso concreto.' },
          { p: '"Se demora mucho la entrega." ¿Cuál es el mejor argumento?', o: ['"Así es, no hay nada que hacer"', '"Es un proceso artesanal, hecho a mano para ti, y tenemos mucha demanda; si lo separas hoy aseguras tu cupo"', '"Le prometo que llega en una semana"'], c: 1, e: 'Proceso artesanal + mucha demanda + asegurar el cupo. Nunca prometas fechas que no da la programación.' },
          { p: '"Está caro." ¿Qué haces?', o: ['Doy un descuento extra', 'Explico el valor: fabricantes, materiales, garantía', 'Le digo que busque en otro lado'], c: 1, e: 'Se vende valor. No hay descuento adicional al de la promoción.' },
          { p: 'Una objeción es…', o: ['Un "no" definitivo', 'Una duda que el cliente necesita resolver para comprar', 'Una falta de respeto'], c: 1, e: 'Escucha, valida y responde con hechos.' },
        ],
      },
      {
        id: 'errores', titulo: 'Errores que no podemos cometer', minutos: 4,
        bloques: [
          { t: 'lista', titulo: 'Lo que NO se hace', items: [
            'Ser seco: responder con monosílabos o solo con el precio.',
            'Dejar morir la conversación: todo el tiempo hay que mantenerla viva, con una pregunta, una foto o un tema nuevo.',
            'Mandar el precio sin antes entender qué busca el cliente.',
            'Prometer una fecha de entrega que no da la programación.',
            'Dar descuentos que no están en la promoción.',
            'Decir o dejar entender que el cuero vegano es cuero animal.',
            'No hacer seguimiento a quien no compró.',
          ] },
          { t: 'lista', titulo: 'Lo que SÍ se hace', items: [
            'Asesorar: preguntar, escuchar y recomendar.',
            'Terminar cada mensaje con una pregunta o un siguiente paso.',
            'Mandar fotos y videos reales de nuestros sofás y de la fábrica.',
            'Hablar con seguridad de nuestra trayectoria: especialistas, fabricantes, más de 8.000 sofás.',
          ] },
          { t: 'tip', x: 'Regla de oro en WhatsApp: nunca dejes un mensaje sin una pregunta al final. Ejemplo: "¿Para qué espacio lo estás buscando?"' },
        ],
        quiz: [
          { p: 'Un cliente escribe "precio del Cheers". ¿Cuál es la mejor respuesta?', o: ['"$2.495.000"', 'Saludar, dar el precio y preguntar para qué espacio lo busca y qué medida necesita', 'No responder hasta que pregunte más'], c: 1, e: 'Nunca seco: precio + asesoría + una pregunta para seguir la conversación.' },
          { p: '¿Cómo debe terminar cada mensaje al cliente?', o: ['Con un "ok"', 'Con una pregunta o un siguiente paso', 'Con el precio'], c: 1, e: 'Así la conversación no muere.' },
          { p: '¿Cuál de estos es un error?', o: ['Mandar una foto de un sofá entregado', 'Prometer una fecha que no da la programación', 'Preguntar la medida del espacio'], c: 1, e: 'Las fechas salen de la programación del ERP.' },
        ],
      },
    ],
  },
  {
    id: 'm5', titulo: 'Canales y ERP', icono: '📱',
    lecciones: [
      {
        id: 'canales', titulo: 'Tienda, WhatsApp e Instagram', minutos: 5,
        bloques: [
          { t: 'tabla', cols: ['Canal', 'Cómo funciona'], filas: [
            ['Tienda 85', 'Cra. 19A # 85-69. Lunes a sábado de 11 a.m. a 6 p.m. Domingos de 12 m. a 4 p.m. (solo dos domingos al mes).'],
            ['WhatsApp', 'Nuestro canal más importante: 315 882 5393. Aquí se cierra la mayoría de las ventas.'],
            ['Instagram', 'Donde sacamos la pauta. Los interesados suelen pasar a WhatsApp.'],
            ['Falabella y página web', 'Pedidos que llegan por esos canales; se atienden igual de bien.'],
          ] },
          { t: 'lista', titulo: 'En la tienda', items: [
            'Recibe a cada persona en los primeros segundos y ofrécele sentarse.',
            'Mantén los sofás limpios, alineados y con los cojines en su lugar.',
            'Si el cliente no compra, pide su WhatsApp para el seguimiento.',
          ] },
          { t: 'lista', titulo: 'En WhatsApp', items: [
            'Responde lo más rápido posible: el cliente que espera se va con otro.',
            'Usa fotos y videos reales; un audio corto y amable también funciona.',
            'Cada conversación debe terminar con una pregunta o un siguiente paso.',
          ] },
        ],
        quiz: [
          { p: '¿Cuál es el horario de la tienda de lunes a sábado?', o: ['9 a.m. a 5 p.m.', '11 a.m. a 6 p.m.', '10 a.m. a 8 p.m.'], c: 1, e: 'Lunes a sábado de 11 a.m. a 6 p.m.' },
          { p: '¿Cuál es nuestro canal de ventas más importante?', o: ['WhatsApp', 'Correo', 'Teléfono fijo'], c: 0, e: 'WhatsApp, 315 882 5393.' },
          { p: '¿Cuántos domingos al mes abre la tienda?', o: ['Todos', 'Dos', 'Ninguno'], c: 1, e: 'Solo dos domingos al mes, de 12 m. a 4 p.m.' },
        ],
      },
      {
        id: 'erp', titulo: 'Cotizaciones y pedidos en el ERP', minutos: 4,
        bloques: [
          { t: 'lista', titulo: 'Cotizaciones', items: [
            'Las cotizaciones se hacen en el ERP (menú Cotizaciones): modelo, medida, tela, cantidad y precio.',
            'El ERP genera la cotización para enviarla al cliente por WhatsApp o correo.',
            'Cuando el cliente acepta, la cotización se convierte en pedido.',
          ] },
          { t: 'lista', titulo: 'Pedidos', items: [
            'Los pedidos los registra Joseph en el ERP.',
            'Para registrarlo necesita: nombre completo, cédula o NIT, teléfono, correo, dirección de entrega, modelo, medida, tela, precio, abono, medio de pago y canal de venta.',
            'La fecha de entrega sale de la programación de la fábrica.',
          ] },
          { t: 'tip', x: 'Pide todos los datos del cliente desde el principio. Un pedido completo evita errores en la entrega y en la factura.' },
        ],
        quiz: [
          { p: '¿Dónde se hacen las cotizaciones?', o: ['En un papel', 'En el ERP', 'En Excel'], c: 1, e: 'Menú Cotizaciones del ERP.' },
          { p: '¿Quién registra los pedidos en el ERP?', o: ['Cualquier vendedor', 'Joseph', 'El cliente'], c: 1, e: 'Por ahora los registra Joseph.' },
          { p: '¿De dónde sale la fecha de entrega?', o: ['De lo que pida el cliente', 'De la programación de la fábrica', 'Siempre 15 días'], c: 1, e: 'El ERP la calcula con el primer cupo libre.' },
        ],
      },
    ],
  },
]

export const LECCIONES = MODULOS.flatMap(m => m.lecciones.map(l => ({ ...l, modulo: m.id })))
