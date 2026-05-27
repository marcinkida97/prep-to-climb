# Projekt Kursowy 10xDevs: Aplikacja Treningowa dla Wspinaczy

## 1. Koncepcja i Cel
Aplikacja ułatwiająca wspinaczom dobór odpowiedniej rozgrzewki i planu treningowego. Rozwiązuje konkretny problem: unikanie rutyny i złego przygotowania do sesji wspinaczkowej poprzez dostarczanie spersonalizowanych rekomendacji.

## 2. Tabela Oceny Projektu (Zero-to-One)
Zgodnie z wytycznymi, projekt musi mieć niski próg wejścia i szybko dostarczać wartość.

| Kryterium | Odpowiedź dla projektu |
| :--- | :--- |
| **Użytkownik** | Wspinacz poszukujący optymalnej rozgrzewki/treningu. |
| **Problem** | Brak spersonalizowanego przygotowania do wspinania; uniwersalne plany nie sprawdzają się dla każdego. |
| **MVP** | Użytkownik loguje się, wypełnia krótką ankietę (4 pytania), a system generuje mu dedykowany zestaw rozgrzewkowy. |
| **Dane** | Wyniki ankiet (metryki siłowe, preferencje), predefiniowana baza ćwiczeń, wygenerowane plany. |
| **Logika biznesowa** | System klasyfikuje użytkownika na podstawie wyników ankiety (np. siła palców, max podciągnięć) i na tej podstawie filtruje oraz dobiera optymalne ćwiczenia. |
| **Test** | Zautomatyzowany test sprawdzający główny przepływ: logowanie -> wypełnienie ankiety -> otrzymanie rekomendacji. |
| **CI/CD** | Zautomatyzowany pipeline budujący aplikację i uruchamiający testy po każdym commit'cie. |

## 3. Realizacja Wymagań Certyfikacyjnych

* **Mechanizm kontroli dostępu:** Aplikacja w wersji MVP będzie posiadała system logowania, aby rozróżniać użytkowników i ich zapisane ankiety.
* **Zarządzanie danymi (CRUD):** Tworzenie i aktualizowanie wyników ankiet, odczytywanie bazy ćwiczeń, generowanie indywidualnego planu.
* **Logika biznesowa w jednym zdaniu:** "Aplikacja analizuje wyniki ankiety siłowej i preferencji wspinacza, aby wygenerować bezpieczną i efektywną rozgrzewkę dopasowaną do jego aktualnego poziomu".
* **Zakres MVP (Reguła 1 tygodnia):** Minimalny produkt zakłada dostarczenie działającego przepływu ankiety i rekomendacji w pierwszym tygodniu pracy po godzinach, co zapobiegnie "utopieniu czasu" na poboczne funkcje.

## 4. Architektura i Stack Technologiczny
*Do ustalenia w pierwszym tygodniu kursu.* Zgodnie z zaleceniami wybierzemy technologię (web/mobile/desktop), która opiera się na znanych konwencjach i posiada dobrą dokumentację, co ułatwi pracę z agentem AI i zmniejszy ryzyko problemów z infrastrukturą.