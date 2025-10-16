const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');
const axios = require('axios');

// Your store URLs array (paste the 300+ stores here)
const STORE_URLS = [
  { name: 'Kith', url: 'https://kith.com' },
  { name: 'Gymshark', url: 'https://www.gymshark.com' },
  { name: 'Allbirds', url: 'https://www.allbirds.com' },
  { name: 'Fashion Nova', url: 'https://www.fashionnova.com' },
  { name: 'Brooklinen', url: 'https://www.brooklinen.com' },
  { name: 'Huel', url: 'https://huel.com' },
  { name: 'MVMT Watches', url: 'https://www.mvmt.com' },
  { name: 'Rothy\'s', url: 'https://rothys.com' },
  { name: 'Taylor Stitch', url: 'https://www.taylorstitch.com' },
  { name: 'Chubbies', url: 'https://chubbies.com' },
  { name: 'Untuckit', url: 'https://untuckit.com' },
  { name: 'Mack Weldon', url: 'https://mackweldon.com' },
  { name: 'ThirdLove', url: 'https://www.thirdlove.com' },
  { name: 'Cuyana', url: 'https://cuyana.com' },
  { name: 'Hill House Home', url: 'https://hillhousehome.com' },
  { name: 'Parachute Home', url: 'https://parachutehome.com' },
  { name: 'Outerknown', url: 'https://www.outerknown.com' },
  { name: 'Reformation', url: 'https://www.thereformation.com' },
  { name: 'Everlane', url: 'https://www.everlane.com' },
  { name: 'Casper', url: 'https://casper.com' },
  { name: 'Purple', url: 'https://purple.com' },
  { name: 'Tuft & Needle', url: 'https://www.tuftandneedle.com' },
  { name: 'Koala', url: 'https://koala.com' },
  { name: 'Burrow', url: 'https://burrow.com' },
  { name: 'Floyd Home', url: 'https://floydhome.com' },
  { name: 'Article', url: 'https://www.article.com' },
  { name: 'Wayfair', url: 'https://www.wayfair.com' },
  { name: 'AllModern', url: 'https://www.allmodern.com' },
  { name: 'Jungalow', url: 'https://jungalow.com' },
  { name: 'The Citizenry', url: 'https://the-citizenry.com' },
  { name: 'Food52', url: 'https://food52.com' },
  { name: 'Our Place', url: 'https://fromourplace.com' },
  { name: 'Greats', url: 'https://greats.com' },
  { name: 'Oliver Cabell', url: 'https://www.olivercabell.com' },
  { name: 'Atoms', url: 'https://atoms.com' },
  { name: 'Cariuma', url: 'https://cariuma.com' },
  { name: 'Veja', url: 'https://www.veja-store.com' },
  { name: 'APL', url: 'https://www.apolloneurology.com' },
  { name: 'Birdies', url: 'https://birdies.com' },
  { name: 'Bombas', url: 'https://bombas.com' },
  { name: 'Stance', url: 'https://www.stance.com' },
  { name: 'Champion', url: 'https://www.champion.com' },
  { name: 'Aime Leon Dore', url: 'https://www.aimeleondore.com' },
  { name: 'Noah', url: 'https://www.noahny.com' },
  { name: 'Stone Island', url: 'https://www.stoneisland.com' },
  { name: 'Off-White', url: 'https://www.off---white.com' },
  { name: 'Palm Angels', url: 'https://www.palmangels.com' },
  { name: 'Rhude', url: 'https://rhude.com' },
  { name: 'Fear of God', url: 'https://fearofgod.com' },
  { name: 'Amiri', url: 'https://amiri.com' },
  { name: 'John Elliott', url: 'https://johnelliott.com' },
  { name: 'A Cold Wall', url: 'https://acoldwall.com' },
  { name: 'Heron Preston', url: 'https://www.heronpreston.com' },
  { name: '1017 ALYX 9SM', url: 'https://www.alyxstudio.com' },
  { name: 'Martine Rose', url: 'https://martine-rose.com' },
  { name: 'Craig Green', url: 'https://craiggreen.co.uk' },
  { name: 'Grace Wales Bonner', url: 'https://walesbonner.net' },
  { name: 'Simone Rocha', url: 'https://simonerocha.com' },
  { name: 'Molly Goddard', url: 'https://mollygoddard.com' },
  { name: 'Richard Quinn', url: 'https://richardquinn.london' },
  { name: 'Charles Jeffrey Loverboy', url: 'https://charlesjeffrey.net' },
  { name: 'Art School', url: 'https://artschool.london' },
  { name: 'Kiko Kostadinov', url: 'https://kikokostadinov.com' },
  { name: 'Auralee', url: 'https://auralee.jp' },
  { name: 'Needles', url: 'https://needles.jp' },
  { name: 'Kapital', url: 'https://kapital.jp' },
  { name: 'Visvim', url: 'https://www.visvim.tv' },
  { name: 'Sophie Bille Brahe', url: 'https://sophiebillebrahe.com' },
  { name: 'Anissa Kermiche', url: 'https://anissakermiche.com' },
  { name: 'Alighieri', url: 'https://alighieri.co.uk' },
  { name: 'Completedworks', url: 'https://completedworks.com' },
  { name: 'Edge of Ember', url: 'https://edgeofember.com' },
  { name: 'Missoma', url: 'https://missoma.com' },
  { name: 'Oscar de la Renta', url: 'https://www.oscardelarenta.com' },
  { name: 'Carolina Herrera', url: 'https://www.carolinaherrera.com' },
  { name: 'Zac Posen', url: 'https://zacposen.com' },
  { name: 'Jason Wu', url: 'https://jasonwustudio.com' },
  { name: 'Prabal Gurung', url: 'https://prabalgurung.com' },
  { name: 'Joseph Altuzarra', url: 'https://altuzarra.com' },
  { name: 'Monse', url: 'https://monse.com' },
  { name: 'Area', url: 'https://area.com' },
  { name: 'Collina Strada', url: 'https://collinastrada.com' },
  { name: 'Batsheva', url: 'https://batsheva.com' },
  { name: 'Staud', url: 'https://staud.clothing' },
  { name: 'Ganni', url: 'https://www.ganni.com' },
  { name: 'Rotate Birger Christensen', url: 'https://rotatebirgerchristensen.com' },
  { name: 'Cecilie Bahnsen', url: 'https://ceciliebahnsen.com' },
  { name: 'Stand Studio', url: 'https://standstudio.com' },
  { name: 'House of Sunny', url: 'https://houseofsunny.co.uk' },
  { name: 'With Jéan', url: 'https://withjean.com' },
  { name: 'Realisation Par', url: 'https://realisationpar.com' },
  { name: 'Rat & Boa', url: 'https://ratandboa.com' },
  { name: 'Faithfull the Brand', url: 'https://faithfullthebrand.com' },
  { name: 'St. Agni', url: 'https://stagni.com.au' },
  { name: 'Aje', url: 'https://aje.com.au' },
  { name: 'Zimmermann', url: 'https://www.zimmermann.com' },
  { name: 'Dion Lee', url: 'https://dionlee.com' },
  { name: 'Christopher Esber', url: 'https://christopheresber.com' },
  { name: 'Alice McCall', url: 'https://alicemccall.com' },
  { name: 'Manning Cartell', url: 'https://manningcartell.com' },
  { name: 'Bec & Bridge', url: 'https://becandbridge.com' },
  { name: 'Aje Athletica', url: 'https://ajeathletica.com' },
  { name: 'PE Nation', url: 'https://penation.com.au' },
  { name: 'Lorna Jane', url: 'https://www.lornajane.com' },
  { name: 'Sweaty Betty', url: 'https://www.sweatybetty.com' },
  { name: 'Alo Yoga', url: 'https://www.aloyoga.com' },
  { name: 'Beyond Yoga', url: 'https://beyondyoga.com' },
  { name: 'Varley', url: 'https://varleylondon.com' },
  { name: 'Tully Lou', url: 'https://tullylou.com' },
  { name: 'Year of Ours', url: 'https://yearofours.com' },
  { name: 'Tracksmith', url: 'https://www.tracksmith.com' },
  { name: 'Ten Thousand', url: 'https://tenthousand.cc' },
  { name: 'Vuori', url: 'https://vuori.com' },
  { name: 'Rhone', url: 'https://rhone.com' },
  { name: 'Public Rec', url: 'https://publicrec.com' },
  { name: 'Olivers Apparel', url: 'https://oliversapparel.com' },
  { name: 'Bearbottom Clothing', url: 'https://bearbottomclothing.com' },
  { name: 'Southern Tide', url: 'https://southerntide.com' },
  { name: 'Southern Marsh', url: 'https://southernmarsh.com' },
  { name: 'The Kasper Company', url: 'https://thekaspercompany.com' },
  { name: 'The Black Tux', url: 'https://theblacktux.com' },
  { name: 'Generation Tux', url: 'https://generationtux.com' },
  { name: 'Menguin', url: 'https://menguin.com' },
  { name: 'Stitch Fix', url: 'https://www.stitchfix.com' },
  { name: 'Trunk Club', url: 'https://www.trunkclub.com' },
  { name: 'Wantable', url: 'https://wantable.com' },
  { name: 'Daily Look', url: 'https://dailylook.com' },
  { name: 'Le Tote', url: 'https://letote.com' },
  { name: 'Rent the Runway', url: 'https://www.renttherunway.com' },
  { name: 'Nuuly', url: 'https://nuuly.com' },
  { name: 'Armoire', url: 'https://armoire.style' },
  { name: 'Vince', url: 'https://vince.com' },
  { name: 'Theory', url: 'https://theory.com' },
  { name: 'A.L.C.', url: 'https://alcltd.com' },
  { name: 'Rag & Bone', url: 'https://www.rag-bone.com' },
  { name: 'Frame Denim', url: 'https://framedenim.com' },
  { name: 'AG Jeans', url: 'https://agjeans.com' },
  { name: 'Joe\'s Jeans', url: 'https://joesjeans.com' },
  { name: 'Hudson Jeans', url: 'https://hudsonjeans.com' },
  { name: 'Paige', url: 'https://paige.com' },
  { name: 'Mother Denim', url: 'https://motherdenim.com' },
  { name: 'J Brand', url: 'https://jbrandjeans.com' },
  { name: 'DL1961', url: 'https://dl1961.com' },
  { name: 'Good American', url: 'https://goodamerican.com' },
  { name: 'Grlfrnd Denim', url: 'https://grlfrnd.com' },
  { name: 'Re/Done', url: 'https://shopredone.com' },
  { name: 'A Gold E', url: 'https://agolde.com' },
  { name: 'Denim Forum', url: 'https://denimforum.com' },
  { name: 'Abercrombie & Fitch', url: 'https://www.abercrombie.com' },
  { name: 'Hollister Co.', url: 'https://www.hollisterco.com' },
  { name: 'American Eagle', url: 'https://www.ae.com' },
  { name: 'Aerie', url: 'https://www.aerie.com' },
  { name: 'PacSun', url: 'https://www.pacsun.com' },
  { name: 'Tillys', url: 'https://www.tillys.com' },
  { name: 'Zumiez', url: 'https://www.zumiez.com' },
  { name: 'Vans', url: 'https://www.vans.com' },
  { name: 'Converse', url: 'https://www.converse.com' },
  { name: 'Dr. Martens', url: 'https://www.drmartens.com' },
  { name: 'Timberland', url: 'https://www.timberland.com' },
  { name: 'UGG', url: 'https://www.ugg.com' },
  { name: 'Birkenstock', url: 'https://www.birkenstock.com' },
  { name: 'Crocs', url: 'https://www.crocs.com' },
  { name: 'Hey Dude', url: 'https://heydude.com' },
  { name: 'On Running', url: 'https://www.on-running.com' },
  { name: 'Hoka', url: 'https://www.hoka.com' },
  { name: 'Koio', url: 'https://koio.co' },
  { name: 'Thursday Boots', url: 'https://thursdayboots.com' },
  { name: 'Blundstone', url: 'https://blundstone.com' },
  { name: 'Red Wing Shoes', url: 'https://redwingshoes.com' },
  { name: 'Wolverine', url: 'https://wolverine.com' },
  { name: 'CAT Footwear', url: 'https://catfootwear.com' },
  { name: 'Merrell', url: 'https://merrell.com' },
  { name: 'Keen', url: 'https://keenfootwear.com' },
  { name: 'Teva', url: 'https://teva.com' },
  { name: 'Chaco', url: 'https://chacos.com' },
  { name: 'Sanuk', url: 'https://sanuk.com' },
  { name: 'Olukai', url: 'https://olukai.com' },
  { name: 'Vionic', url: 'https://vionicshoes.com' },
  { name: 'Margaux', url: 'https://margauxny.com' },
  { name: 'Sarah Flint', url: 'https://sarahflint.com' },
  { name: 'M.Gemi', url: 'https://mgemi.com' },
  { name: 'Beckett Simonon', url: 'https://beckettsimonon.com' },
  { name: 'Carlos Santos', url: 'https://carlossantos.com' },
  { name: 'Meermin', url: 'https://meermin.com' },
  { name: 'Carmina', url: 'https://carminashoemaker.com' },
  { name: 'Allen Edmonds', url: 'https://allenedmonds.com' },
  { name: 'Alden', url: 'https://alden-shoes.com' },
  { name: 'Rancourt & Co.', url: 'https://rancourtandcompany.com' },
  { name: 'Oak Street Bootmakers', url: 'https://oakstreetbootmakers.com' },
  { name: 'Yuketen', url: 'https://yuketen.com' },
  { name: 'Russell Moccasin', url: 'https://russellmoccasin.com' },
  { name: 'L.L.Bean', url: 'https://llbean.com' },
  { name: 'Filson', url: 'https://filson.com' },
  { name: 'Pendleton', url: 'https://pendleton-usa.com' },
  { name: 'Woolrich', url: 'https://woolrich.com' },
  { name: 'Canada Goose', url: 'https://canadagoose.com' },
  { name: 'Arc\'teryx', url: 'https://arcteryx.com' },
  { name: 'Patagonia', url: 'https://patagonia.com' },
  { name: 'The North Face', url: 'https://thenorthface.com' },
  { name: 'Columbia', url: 'https://columbia.com' },
  { name: 'Marmot', url: 'https://marmot.com' },
  { name: 'Mountain Hardwear', url: 'https://mountainhardwear.com' },
  { name: 'Outdoor Research', url: 'https://outdoorresearch.com' },
  { name: 'Black Diamond', url: 'https://blackdiamondequipment.com' },
  { name: 'REI', url: 'https://rei.com' },
  { name: 'Backcountry', url: 'https://backcountry.com' },
  { name: 'Steep & Cheap', url: 'https://steepandcheap.com' },
  { name: 'Moosejaw', url: 'https://moosejaw.com' },
  { name: 'Evo', url: 'https://evo.com' },
  { name: 'The House', url: 'https://the-house.com' },
  { name: 'Sierra', url: 'https://sierra.com' },
  { name: 'Campmor', url: 'https://campmor.com' },
  { name: 'Eastern Mountain Sports', url: 'https://ems.com' },
  { name: 'Sunski', url: 'https://sunski.com' },
  { name: 'Shady Rays', url: 'https://shadyrays.com' },
  { name: 'Blenders Eyewear', url: 'https://blenderseyewear.com' },
  { name: 'Knockaround', url: 'https://knockaround.com' },
  { name: 'Warby Parker', url: 'https://warbyparker.com' },
  { name: 'Felix Gray', url: 'https://felixgray.com' },
  { name: 'Peepers', url: 'https://peepers.com' },
  { name: 'Zenni Optical', url: 'https://zennioptical.com' },
  { name: 'EyeBuyDirect', url: 'https://eyebuydirect.com' },
  { name: 'Firmoo', url: 'https://firmoo.com' },
  { name: 'GlassesUSA', url: 'https://glassesusa.com' },
  { name: 'Liingo', url: 'https://liingoeyewear.com' },
  { name: 'Kits', url: 'https://kits.com' },
  { name: 'Clearly', url: 'https://clearly.com' },
  { name: 'Coastal', url: 'https://coastal.com' },
  { name: '39DollarGlasses', url: 'https://39dollarglasses.com' },
  { name: 'Goggles4u', url: 'https://goggles4u.com' },
  { name: 'Vision Pros', url: 'https://visionpros.com' },
  { name: 'DiscountGlasses', url: 'https://discountglasses.com' },
  { name: 'Glasses com', url: 'https://glasses.com' },
  { name: 'Sunglass Hut', url: 'https://sunglasshut.com' },
  { name: 'Ray-Ban', url: 'https://ray-ban.com' },
  { name: 'Oakley', url: 'https://oakley.com' },
  { name: 'Maui Jim', url: 'https://mauijim.com' },
  { name: 'Costa Del Mar', url: 'https://costadelmar.com' },
  { name: 'Smith Optics', url: 'https://smithoptics.com' },
  { name: 'Julbo', url: 'https://julbo.com' },
  { name: 'Electric', url: 'https://electriccalifornia.com' },
  { name: 'Spy Optic', url: 'https://spyoptic.com' },
  { name: 'VonZipper', url: 'https://vonzipper.com' },
  { name: 'Dragon', url: 'https://dragonalliance.com' },
  { name: 'Zeal Optics', url: 'https://zealoptics.com' },
  { name: 'Bollé', url: 'https://bolle.com' },
  { name: 'Cébé', url: 'https://cebe.com' },
  { name: 'Uvex', url: 'https://uvex-sports.com' },
  { name: 'Alpina', url: 'https://alpina-eyewear.com' },
  { name: 'Carrera', url: 'https://carrera.com' },
  { name: 'Polaroid Eyewear', url: 'https://polaroideyewear.com' },
  { name: 'Arnette', url: 'https://arnette.com' },
  { name: 'Revo', url: 'https://revo.com' },
  { name: 'Serengeti', url: 'https://serengeti-eyewear.com' },
  { name: 'Persol', url: 'https://persol.com' },
  { name: 'Oliver Peoples', url: 'https://oliverpeoples.com' },
  { name: 'Tom Ford', url: 'https://tomford.com' },
  { name: 'Gucci', url: 'https://gucci.com' },
  { name: 'Prada', url: 'https://prada.com' },
  { name: 'Chanel', url: 'https://chanel.com' },
  { name: 'Dior', url: 'https://dior.com' },
  { name: 'Saint Laurent', url: 'https://ysl.com' },
  { name: 'Bottega Veneta', url: 'https://bottegaveneta.com' },
  { name: 'Balenciaga', url: 'https://balenciaga.com' },
  { name: 'Celine', url: 'https://celine.com' },
  { name: 'Givenchy', url: 'https://givenchy.com' },
  { name: 'Fendi', url: 'https://fendi.com' },
  { name: 'Valentino', url: 'https://valentino.com' },
  { name: 'Versace', url: 'https://versace.com' },
  { name: 'Dolce & Gabbana', url: 'https://dolcegabbana.com' },
  { name: 'Burberry', url: 'https://burberry.com' },
  { name: 'Alexander McQueen', url: 'https://alexandermcqueen.com' },
  { name: 'Stella McCartney', url: 'https://stellamccartney.com' },
  { name: 'Issey Miyake', url: 'https://isseymiyake.com' },
  { name: 'Comme des Garçons', url: 'https://comme-des-garcons.com' },
  { name: 'Yohji Yamamoto', url: 'https://yohjiyamamoto.co.jp' },
  { name: 'Junya Watanabe', url: 'https://junyawatanabe.com' },
  { name: 'Undercover', url: 'https://undercoverism.com' },
  { name: 'Number (N)ine', url: 'https://numbernine.jp' },
  { name: 'Mastermind Japan', url: 'https://mastermind-japan.com' },
  { name: 'Bape', url: 'https://bape.com' },
  { name: 'Neighborhood', url: 'https://neighborhood.jp' },
  { name: 'WTAPS', url: 'https://wtaps.com' },
  { name: 'Supreme', url: 'https://supremenewyork.com' },
  { name: 'Palace', url: 'https://palaceskateboards.com' },
  { name: 'CP Company', url: 'https://cpcompany.com' },
  { name: 'Moncler', url: 'https://moncler.com' },
  { name: 'Skims', url: 'https://skims.com' },
  { name: 'Goodlife', url: 'https://goodlife.com' },
  { name: 'MATE the Label', url: 'https://matethelabel.com' },
  { name: 'Kotn', url: 'https://kotn.com' },
  { name: 'Basket', url: 'https://basket.com' },
  { name: 'Bread', url: 'https://bread.com' },
  { name: 'Jacquemus', url: 'https://jacquemus.com' },
  { name: 'Marine Serre', url: 'https://marineserre.com' },
  { name: 'Coperni', url: 'https://coperni.com' },
  { name: 'Dylan Lex', url: 'https://dylanlex.com' },
  { name: 'Wray', url: 'https://wray.nyc' },
  { name: 'Bode', url: 'https://bode.com' },
  { name: 'Eckhaus Latta', url: 'https://eckhauslatta.com' },
  { name: 'Batsheva', url: 'https://batsheva.com' },
  { name: 'Staud', url: 'https://staud.clothing' },
  { name: 'Ganni', url: 'https://www.ganni.com' },
  { name: 'Rotate Birger Christensen', url: 'https://rotatebirgerchristensen.com' },
  { name: 'Cecilie Bahnsen', url: 'https://ceciliebahnsen.com' },
  { name: 'Stand Studio', url: 'https://standstudio.com' },
  { name: 'House of Sunny', url: 'https://houseofsunny.co.uk' },
  { name: 'With Jéan', url: 'https://withjean.com' },
  { name: 'Realisation Par', url: 'https://realisationpar.com' },
  { name: 'Rat & Boa', url: 'https://ratandboa.com' },
  { name: 'Faithfull the Brand', url: 'https://faithfullthebrand.com' },
  { name: 'St. Agni', url: 'https://stagni.com.au' },
  { name: 'Aje', url: 'https://aje.com.au' },
  { name: 'Zimmermann', url: 'https://www.zimmermann.com' },
  { name: 'Dion Lee', url: 'https://dionlee.com' },
  { name: 'Christopher Esber', url: 'https://christopheresber.com' },
  { name: 'Alice McCall', url: 'https://alicemccall.com' },
  { name: 'Manning Cartell', url: 'https://manningcartell.com' },
  { name: 'Bec & Bridge', url: 'https://becandbridge.com' },
  { name: 'Aje Athletica', url: 'https://ajeathletica.com' },
  { name: 'PE Nation', url: 'https://penation.com.au' },
  { name: 'Lorna Jane', url: 'https://www.lornajane.com' },
  { name: 'Sweaty Betty', url: 'https://www.sweatybetty.com' },
  { name: 'Alo Yoga', url: 'https://www.aloyoga.com' },
  { name: 'Beyond Yoga', url: 'https://beyondyoga.com' },
  { name: 'Varley', url: 'https://varleylondon.com' },
  { name: 'Tully Lou', url: 'https://tullylou.com' },
  { name: 'Year of Ours', url: 'https://yearofours.com' },
  { name: 'Tracksmith', url: 'https://www.tracksmith.com' },
  { name: 'Ten Thousand', url: 'https://tenthousand.cc' },
  { name: 'Vuori', url: 'https://vuori.com' },
  { name: 'Rhone', url: 'https://rhone.com' },
  { name: 'Public Rec', url: 'https://publicrec.com' },
  { name: 'Olivers Apparel', url: 'https://oliversapparel.com' },
  { name: 'Bearbottom Clothing', url: 'https://bearbottomclothing.com' },
  { name: 'Southern Tide', url: 'https://southerntide.com' },
  { name: 'Southern Marsh', url: 'https://southernmarsh.com' },
  { name: 'The Kasper Company', url: 'https://thekaspercompany.com' },
  { name: 'The Black Tux', url: 'https://theblacktux.com' },
  { name: 'Generation Tux', url: 'https://generationtux.com' },
  { name: 'Menguin', url: 'https://menguin.com' },
  { name: 'Stitch Fix', url: 'https://www.stitchfix.com' },
  { name: 'Trunk Club', url: 'https://www.trunkclub.com' },
  { name: 'Wantable', url: 'https://wantable.com' },
  { name: 'Daily Look', url: 'https://dailylook.com' },
  { name: 'Le Tote', url: 'https://letote.com' },
  { name: 'Rent the Runway', url: 'https://www.renttherunway.com' },
  { name: 'Nuuly', url: 'https://nuuly.com' },
  { name: 'Armoire', url: 'https://armoire.style' },
  { name: 'Vince', url: 'https://vince.com' },
  { name: 'Theory', url: 'https://theory.com' },
  { name: 'A.L.C.', url: 'https://alcltd.com' },
  { name: 'Rag & Bone', url: 'https://www.rag-bone.com' },
  { name: 'Frame Denim', url: 'https://framedenim.com' },
  { name: 'AG Jeans', url: 'https://agjeans.com' },
  { name: 'Joe\'s Jeans', url: 'https://joesjeans.com' },
  { name: 'Hudson Jeans', url: 'https://hudsonjeans.com' },
  { name: 'Paige', url: 'https://paige.com' },
  { name: 'Mother Denim', url: 'https://motherdenim.com' },
  { name: 'J Brand', url: 'https://jbrandjeans.com' },
  { name: 'DL1961', url: 'https://dl1961.com' },
  { name: 'Good American', url: 'https://goodamerican.com' },
  { name: 'Grlfrnd Denim', url: 'https://grlfrnd.com' },
  { name: 'Re/Done', url: 'https://shopredone.com' },
  { name: 'A Gold E', url: 'https://agolde.com' },
  { name: 'Denim Forum', url: 'https://denimforum.com' },
  { name: 'Abercrombie & Fitch', url: 'https://www.abercrombie.com' },
  { name: 'Hollister Co.', url: 'https://www.hollisterco.com' },
  { name: 'American Eagle', url: 'https://www.ae.com' },
  { name: 'Aerie', url: 'https://www.aerie.com' },
  { name: 'PacSun', url: 'https://www.pacsun.com' },
  { name: 'Tillys', url: 'https://www.tillys.com' },
  { name: 'Zumiez', url: 'https://www.zumiez.com' },
  { name: 'Vans', url: 'https://www.vans.com' },
  { name: 'Converse', url: 'https://www.converse.com' },
  { name: 'Dr. Martens', url: 'https://www.drmartens.com' },
  { name: 'Timberland', url: 'https://www.timberland.com' },
  { name: 'UGG', url: 'https://www.ugg.com' },
  { name: 'Birkenstock', url: 'https://www.birkenstock.com' },
  { name: 'Crocs', url: 'https://www.crocs.com' },
  { name: 'Hey Dude', url: 'https://heydude.com' },
  { name: 'On Running', url: 'https://www.on-running.com' },
  { name: 'Hoka', url: 'https://www.hoka.com' },
  { name: 'Koio', url: 'https://koio.co' },
  { name: 'Thursday Boots', url: 'https://thursdayboots.com' },
  { name: 'Blundstone', url: 'https://blundstone.com' },
  { name: 'Red Wing Shoes', url: 'https://redwingshoes.com' },
  { name: 'Wolverine', url: 'https://wolverine.com' },
  { name: 'CAT Footwear', url: 'https://catfootwear.com' },
  { name: 'Merrell', url: 'https://merrell.com' },
  { name: 'Keen', url: 'https://keenfootwear.com' },
  { name: 'Teva', url: 'https://teva.com' },
  { name: 'Chaco', url: 'https://chacos.com' },
  { name: 'Sanuk', url: 'https://sanuk.com' },
  { name: 'Olukai', url: 'https://olukai.com' },
  { name: 'Vionic', url: 'https://vionicshoes.com' },
  { name: 'Margaux', url: 'https://margauxny.com' },
  { name: 'Sarah Flint', url: 'https://sarahflint.com' },
  { name: 'M.Gemi', url: 'https://mgemi.com' },
  { name: 'Beckett Simonon', url: 'https://beckettsimonon.com' },
  { name: 'Carlos Santos', url: 'https://carlossantos.com' },
  { name: 'Meermin', url: 'https://meermin.com' },
  { name: 'Carmina', url: 'https://carminashoemaker.com' },
  { name: 'Allen Edmonds', url: 'https://allenedmonds.com' },
  { name: 'Alden', url: 'https://alden-shoes.com' },
  { name: 'Rancourt & Co.', url: 'https://rancourtandcompany.com' },
  { name: 'Oak Street Bootmakers', url: 'https://oakstreetbootmakers.com' },
  { name: 'Yuketen', url: 'https://yuketen.com' },
  { name: 'Russell Moccasin', url: 'https://russellmoccasin.com' },
  { name: 'L.L.Bean', url: 'https://llbean.com' },
  { name: 'Filson', url: 'https://filson.com' },
  { name: 'Pendleton', url: 'https://pendleton-usa.com' },
  { name: 'Woolrich', url: 'https://woolrich.com' },
  { name: 'Canada Goose', url: 'https://canadagoose.com' },
  { name: 'Arc\'teryx', url: 'https://arcteryx.com' },
  { name: 'Patagonia', url: 'https://patagonia.com' },
  { name: 'The North Face', url: 'https://thenorthface.com' },
  { name: 'Columbia', url: 'https://columbia.com' },
  { name: 'Marmot', url: 'https://marmot.com' },
  { name: 'Mountain Hardwear', url: 'https://mountainhardwear.com' },
  { name: 'Outdoor Research', url: 'https://outdoorresearch.com' },
  { name: 'Black Diamond', url: 'https://blackdiamondequipment.com' },
  { name: 'REI', url: 'https://rei.com' },
  { name: 'Backcountry', url: 'https://backcountry.com' },
  { name: 'Steep & Cheap', url: 'https://steepandcheap.com' },
  { name: 'Moosejaw', url: 'https://moosejaw.com' },
  { name: 'Evo', url: 'https://evo.com' },
  { name: 'The House', url: 'https://the-house.com' },
  { name: 'Sierra', url: 'https://sierra.com' },
  { name: 'Campmor', url: 'https://campmor.com' },
  { name: 'Eastern Mountain Sports', url: 'https://ems.com' }
];
class ShopifyStoreVerifier {
  constructor() {
    this.verifiedStores = [];
    this.csvWriter = createObjectCsvWriter({
      path: 'verified_stores.csv',
      header: [
        { id: 'name', title: 'NAME' },
        { id: 'url', title: 'URL' },
        { id: 'active', title: 'ACTIVE' }
      ]
    });
  }

  async verifyStore(store) {
    try {
      const url = new URL(store.url);
      const shopifyCheckUrl = `${url.origin}/products.json`;
      
      console.log(`Checking: ${store.name} - ${url.origin}`);

      const response = await axios.get(shopifyCheckUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.status === 200 && response.data.products !== undefined) {
        console.log(`✅ Shopify store verified: ${store.name}`);
        return {
          name: store.name,
          url: url.origin,
          active: false
        };
      } else {
        console.log(`❌ Not a valid Shopify store: ${store.name}`);
        return null;
      }
    } catch (error) {
      if (error.response) {
        // Server responded with non-200 status
        console.log(`❌ Failed to verify (${error.response.status}): ${store.name}`);
      } else if (error.request) {
        // No response received
        console.log(`❌ No response from: ${store.name}`);
      } else {
        // Other errors
        console.log(`❌ Error checking ${store.name}: ${error.message}`);
      }
      return null;
    }
  }

  async verifyAllStores() {
    console.log(`Starting verification of ${STORE_URLS.length} stores...\n`);
    
    for (let i = 0; i < STORE_URLS.length; i++) {
      const store = STORE_URLS[i];
      const verifiedStore = await this.verifyStore(store);
      
      if (verifiedStore) {
        this.verifiedStores.push(verifiedStore);
        
        // Save to CSV after each successful verification
        await this.saveToCSV();
      }

      // Add delay to be respectful to servers (1 second between requests)
      await this.delay(1000);
      
      // Progress update
      const progress = ((i + 1) / STORE_URLS.length * 100).toFixed(1);
      console.log(`Progress: ${i + 1}/${STORE_URLS.length} (${progress}%)`);
    }

    console.log(`\n✅ Completed! Verified ${this.verifiedStores.length} Shopify stores.`);
    console.log(`Results saved to: verified_stores.csv`);
  }

  async saveToCSV() {
    try {
      await this.csvWriter.writeRecords(this.verifiedStores);
    } catch (error) {
      console.error('Error writing to CSV:', error);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateJavaScriptArray() {
    const jsArray = `const DEFAULT_STORES = [\n${this.verifiedStores.map(store => 
      `  { name: '${store.name.replace(/'/g, "\\'")}', url: '${store.url}', active: ${store.active} }`
    ).join(',\n')}\n];`;
    
    fs.writeFileSync('verified_stores.js', jsArray);
    console.log('JavaScript array saved to: verified_stores.js');
  }
}

// Run the verification
async function main() {
  const verifier = new ShopifyStoreVerifier();
  
  try {
    await verifier.verifyAllStores();
    verifier.generateJavaScriptArray();
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Install required packages first:
// npm install axios csv-writer

main();