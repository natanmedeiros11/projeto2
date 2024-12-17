-- Tabela de objetivos
CREATE TABLE objetivos (
    id SERIAL PRIMARY KEY NOT NULL, -- Id do objetivo
    titulo VARCHAR(50) NOT NULL, -- Título do objetivo
    descricao VARCHAR(250) NOT NULL -- Descrição do objetivo
);

-- Inserção de objetivos padrões
INSERT INTO objetivos (titulo, descricao)
VALUES
('Aumentar a produtividade', 'Estabelecer hábitos para melhorar a eficiência no trabalho, como planejar tarefas, estabelecer metas diárias e focar em resultados.'),
('Criar uma rotina de sono saudável', 'Estabelecer um horário fixo para dormir e acordar, criando hábitos que promovam um sono reparador e de qualidade.'),
('Melhorar a saúde física ou mental', 'Trabalhar para equilibrar o corpo e a mente através de atividades que beneficiem ambos, como exercícios físicos, alimentação saudável, meditação e descanso adequado.'),
('Explorar novos interesses e hobbies', 'Experimentar atividades diferentes que estimulem a criatividade e proporcionem prazer, como arte, música, esportes ou voluntariado.');

-- Tabela de usuários
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY NOT NULL, -- Id do usuário
    nome VARCHAR(100) NOT NULL, -- Nome do usuário
    email VARCHAR(200) NOT NULL UNIQUE, -- Email do usuário
    senha_hash VARCHAR(255) NOT NULL, -- Hash da senha do usuário
    objetivo_id INT, -- Chave que aponta para o ID do objetivo do usuário
    FOREIGN KEY (objetivo_id) REFERENCES objetivos(id) ON DELETE SET NULL -- Relacionamento com a tabela de objetivos
);

-- Tabela de categorias
CREATE TABLE categorias (
    id SERIAL PRIMARY KEY NOT NULL, -- Id da categoria
    nome_categoria VARCHAR(100) NOT NULL -- Nome da categoria
);

-- Inserção de categorias padrão
INSERT INTO categorias (nome_categoria)
VALUES
('Outros'),
('Meditação'), 
('Espiritualidade'), 
('Alimentação'),
('Saúde e Bem estar'),
('Lazer ou Hobbies'),
('Exercícios Físicos'),
('Estudos'),
('Organização Pessoal');

-- Tabela de hábitos
CREATE TABLE habitos (
    id_habito SERIAL PRIMARY KEY NOT NULL, -- Id do hábito
    id_categoria INT DEFAULT 0, -- Categoria do hábito
    id_usuario INT NOT NULL, -- Id do usuário que cria o hábito
    descricao VARCHAR(255) NOT NULL, -- Descrição do hábito
    horario_limite TIME, -- Horário limite para a conclusão do hábito
    repeticao_diaria BOOLEAN DEFAULT TRUE, -- Se o hábito é diário
    completado BOOLEAN DEFAULT FALSE, -- Se o hábito foi completado
    FOREIGN KEY (id_categoria) REFERENCES categorias(id) ON DELETE SET NULL, -- Relacionamento com categorias
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE -- Relacionamento com usuários
);

-- Tabela de hábitos padrões
CREATE TABLE habitos_padroes (
    id_habito SERIAL PRIMARY KEY NOT NULL, -- Id do hábito padrão
    id_categoria INT, -- Categoria do hábito padrão
    descricao VARCHAR(255) NOT NULL, -- Descrição do hábito
    FOREIGN KEY (id_categoria) REFERENCES categorias(id) ON DELETE SET NULL -- Relacionamento com categorias
);

-- Inserção de hábitos padrões
INSERT INTO habitos_padroes (descricao, id_categoria)
VALUES
('Dormir 8h por dia', 5),
('Beber 8 copos de água por dia', 5),
('Realizar treino de força', 7),
('Fazer caminhada ao ar livre', 5),
('Ler 10 páginas de um livro', 5),
('Evitar redes sociais por 1 hora após acordar', 5),
('Meditar 10 minutos por dia', 2),
('Estudar por 30 minutos', 8),
('Fazer alongamento antes de dormir', 5),
('Praticar 10 minutos de leitura em inglês ou outro idioma', 8),
('Evitar usar o celular durante as refeições', 5),
('Arrumar a cama ao acordar', 9),
('Organizar a mesa de trabalho ou ambiente', 9);
