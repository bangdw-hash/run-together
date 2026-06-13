-- Sample public meeting places (운영 시 지역별로 대량 적재; POI 소스: 공공데이터/지도 API).
insert into public.public_places (name_ko, name_en, kind, loc) values
  ('여의도한강공원 1주차장 입구', 'Yeouido Hangang Park Gate 1', 'park_entrance', st_setsrid(st_makepoint(126.9314, 37.5286), 4326)),
  ('여의나루역 1번 출구',         'Yeouinaru Stn. Exit 1',        'subway_exit',   st_setsrid(st_makepoint(126.9326, 37.5271), 4326)),
  ('반포한강공원 잠수교 입구',     'Banpo Hangang Park Jamsu Bridge', 'park_entrance', st_setsrid(st_makepoint(126.9961, 37.5128), 4326)),
  ('뚝섬한강공원 자벌레 앞',       'Ttukseom Hangang Park Jabeolle', 'landmark',     st_setsrid(st_makepoint(127.0666, 37.5310), 4326)),
  ('잠실종합운동장 보조경기장',     'Jamsil Stadium Track',          'track',        st_setsrid(st_makepoint(127.0719, 37.5145), 4326)),
  ('서울숲 정문',                 'Seoul Forest Main Gate',        'park_entrance', st_setsrid(st_makepoint(127.0374, 37.5443), 4326)),
  ('센트럴파크 엥겔하드 입구',     'Central Park Engineers Gate',   'park_entrance', st_setsrid(st_makepoint(-73.9580, 40.7900), 4326)),
  ('하이드파크 코너',             'Hyde Park Corner',              'park_entrance', st_setsrid(st_makepoint(-0.1527, 51.5027), 4326));
